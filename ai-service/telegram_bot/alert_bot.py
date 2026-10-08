"""
Telegram Human-in-the-Loop (HITL) Alert Governance Bot

Connects to the Telegram Bot API to deliver real-time AI disaster alert cards
to designated emergency officials and incident commanders.

Captures inline button decisions (Approve / Reject), updates alert status in the
backend database, and triggers public broadcast (DisasterEvent + FCM push)
upon human authorization.

Usage:
  python telegram_bot/alert_bot.py
  python telegram_bot/alert_bot.py --poll-now

Environment Variables:
  TELEGRAM_BOT_TOKEN: Bot token provided by @BotFather
  ADMIN_CHAT_ID     : Telegram Chat ID of emergency manager / admin group
  BACKEND_API_URL   : URL to backend REST API (default: http://localhost:5000/api)
"""

import os
import sys

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

import logging
import asyncio
from typing import Optional, Dict, Any, List

import requests
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s [%(name)s] %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger("telegram_alert_bot")

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
ADMIN_CHAT_ID = os.getenv("ADMIN_CHAT_ID", "")
BACKEND_API_URL = os.getenv("BACKEND_API_URL", "http://localhost:5000/api")
POLL_INTERVAL_SECONDS = int(os.getenv("TELEGRAM_POLL_INTERVAL", "30"))

# Keep track of alert IDs already dispatched to Telegram to avoid duplicate cards
dispatched_alerts: set = set()

# Flag: set True once bot confirms admin chat is reachable
admin_chat_verified: bool = False


def fetch_pending_alerts() -> List[Dict[str, Any]]:
    """Fetches alerts awaiting review from backend /api/ai-alerts/pending."""
    try:
        res = requests.get(f"{BACKEND_API_URL}/ai-alerts/pending", timeout=8)
        if res.status_code == 200:
            data = res.json()
            return data.get("alerts", [])
        logger.warning(f"Backend pending fetch returned {res.status_code}: {res.text[:120]}")
    except Exception as exc:
        logger.error(f"Failed to query pending alerts from backend: {exc}")
    return []


def format_alert_card(alert: Dict[str, Any]) -> str:
    """Formats an AI alert into a high-visibility Telegram Markdown message."""
    district = alert.get("district", "Unknown")
    state = alert.get("state", "India")
    hazard = alert.get("hazardType", "Hydrometeorological Hazard")
    score = alert.get("score", 0.0)
    threat = alert.get("recommendedSeverity", alert.get("threat_level", "Warning"))
    explanation = alert.get("explanation", "Potential severe hazard identified by AI models.")

    f_data = alert.get("forecastData", {})
    rain = f_data.get("precip_24h_mm", "N/A")
    discharge = f_data.get("discharge_m3s", "N/A")
    fri = f_data.get("flood_risk_index")
    fri_text = f"{fri:.3f}" if isinstance(fri, (int, float)) else "N/A"

    card = (
        f"🚨 *DISASTER ALERT — PENDING OPERATOR APPROVAL*\n"
        f"━━━━━━━━━━━━━━━━━━━━━━\n"
        f"📍 *Location:* {district}, {state}\n"
        f"⚠️ *Hazard:* {hazard}\n"
        f"🔥 *Threat Level:* *{threat}* (Composite Risk: `{score:.2f}`)\n"
        f"🌧️ *24h Forecast Rain:* `{rain}` mm\n"
        f"🌊 *River Discharge (GloFAS):* `{discharge}` m³/s\n"
        f"📊 *Flood Risk Index (FRI):* `{fri_text}`\n"
        f"━━━━━━━━━━━━━━━━━━━━━━\n"
        f"🧠 *AI Diagnosis:*\n_{explanation}_\n\n"
        f"⚠️ *Action Required:* Please verify diagnostics and authorize or reject public alert broadcast."
    )
    return card


try:
    from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
    from telegram.request import HTTPXRequest
    from telegram.ext import (
        Application,
        CommandHandler,
        CallbackQueryHandler,
        ContextTypes,
    )
    HAS_TELEGRAM_LIB = True
except ImportError:
    HAS_TELEGRAM_LIB = False
    logger.warning("python-telegram-bot library not installed. Running in mock/headless mode.")


async def dispatch_pending_job(context: Any):
    """Job queue callback that checks for new pending alerts and sends Telegram cards."""
    global dispatched_alerts, admin_chat_verified
    bot = context.bot
    admin_id = context.job.data.get("admin_chat_id")

    if not admin_id:
        return

    # === Guard: Verify admin chat is reachable before spamming alerts ===
    if not admin_chat_verified:
        try:
            await bot.send_message(
                chat_id=admin_id,
                text=(
                    "🤖 *RakshaSetu Disaster Early Warning Bot* — Online!\n\n"
                    "✅ Connection established. I will now forward AI disaster alerts "
                    "here for your review and approval.\n\n"
                    "Use /pending to manually fetch unreviewed alerts."
                ),
                parse_mode="Markdown",
            )
            admin_chat_verified = True
            logger.info(f"Admin chat {admin_id} verified and reachable.")
        except Exception as exc:
            err_str = str(exc)
            if "Chat not found" in err_str or "chat not found" in err_str:
                logger.error(
                    f"ADMIN CHAT NOT FOUND (Chat ID: {admin_id}). "
                    "To fix this: open Telegram, search for your bot, and send it /start. "
                    "The bot cannot initiate a conversation — the admin must message first."
                )
            else:
                logger.warning(f"Cannot reach admin chat {admin_id}: {exc}")
            # Do NOT send alerts if admin chat is unreachable — avoid spam loop
            return

    alerts = fetch_pending_alerts()
    for alert in alerts:
        alert_id = str(alert.get("_id") or alert.get("id"))
        if not alert_id or alert_id in dispatched_alerts:
            continue

        # === Mark as dispatched FIRST to prevent infinite retry spam on send failure ===
        dispatched_alerts.add(alert_id)

        text = format_alert_card(alert)
        keyboard = [
            [
                InlineKeyboardButton("✅ Approve & Broadcast", callback_data=f"approve_{alert_id}"),
                InlineKeyboardButton("❌ Reject Alert", callback_data=f"reject_{alert_id}"),
            ]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)

        try:
            await bot.send_message(
                chat_id=admin_id,
                text=text,
                parse_mode="Markdown",
                reply_markup=reply_markup,
            )
            logger.info(f"Dispatched Telegram card for alert {alert_id} ({alert.get('district')})")
        except Exception as exc:
            logger.error(f"Failed to send Telegram message for alert {alert_id}: {exc}")


async def handle_decision_callback(update: Any, context: Any):
    """Handles operator clicking 'Approve & Broadcast' or 'Reject Alert' inline button."""
    query = update.callback_query
    await query.answer()

    data = query.data or ""
    parts = data.split("_", 1)
    if len(parts) != 2:
        return

    action, alert_id = parts[0], parts[1]
    reviewer_user = query.from_user
    reviewer_name = f"{reviewer_user.full_name} (@{reviewer_user.username})" if reviewer_user.username else reviewer_user.full_name

    logger.info(f"Received HITL decision: action={action} alert_id={alert_id} reviewer={reviewer_name}")

    if action == "approve":
        status_payload = {
            "status": "APPROVED",
            "reviewedBy": f"Telegram: {reviewer_name}",
            "reviewNotes": f"Authorized via Telegram Bot inline button by {reviewer_name}",
        }
    else:
        status_payload = {
            "status": "REJECTED",
            "reviewedBy": f"Telegram: {reviewer_name}",
            "reviewNotes": f"Rejected / suppressed via Telegram Bot by {reviewer_name}",
        }

    # Send decision to backend
    try:
        res = requests.patch(
            f"{BACKEND_API_URL}/ai-alerts/{alert_id}/status",
            json=status_payload,
            timeout=10,
        )
        if res.status_code == 200:
            result = res.json()
            if action == "approve":
                event_title = result.get("event", {}).get("title", "Disaster Alert")
                edit_text = (
                    f"✅ *ALERT APPROVED & BROADCASTED*\n\n"
                    f"👤 *Authorized By:* {reviewer_name}\n"
                    f"📢 *Disaster Event Created:* `{event_title}`\n"
                    f"📲 Push notifications queued for citizens in affected zones."
                )
            else:
                edit_text = (
                    f"❌ *ALERT REJECTED / SUPPRESSED*\n\n"
                    f"👤 *Reviewed By:* {reviewer_name}\n"
                    f"🔒 Alert suppressed from public dissemination. Model log retained."
                )
        else:
            edit_text = f"⚠️ *Error updating status ({res.status_code}):* {res.text[:150]}"
    except Exception as exc:
        edit_text = f"⚠️ *Network error updating alert:* {exc}"

    try:
        await query.edit_message_text(text=edit_text, parse_mode="Markdown")
    except Exception as exc:
        logger.error(f"Failed to edit message: {exc}")


async def cmd_start(update: Any, context: Any):
    """Responds to /start command — also marks admin chat as verified."""
    global admin_chat_verified
    chat_id = update.effective_chat.id

    # Auto-verify admin chat if they send /start
    if str(chat_id) == str(ADMIN_CHAT_ID):
        admin_chat_verified = True
        logger.info(f"Admin chat {chat_id} verified via /start command.")
        admin_note = "\n\n✅ *Admin Chat Verified!* I will now dispatch pending disaster alerts here."
    else:
        admin_note = f"\n\n⚠️ Note: Configured Admin Chat ID is `{ADMIN_CHAT_ID}`. Only the admin receives alert cards."

    await update.message.reply_text(
        f"🤖 *RakshaSetu Disaster Early Warning Governance Bot*\n\n"
        f"Connected to backend: `{BACKEND_API_URL}`\n"
        f"Your Chat ID: `{chat_id}`\n"
        f"Use /pending to view unreviewed alerts.\n"
        f"Use /chatid to confirm your Chat ID.\n"
        f"Use /status to check service health."
        f"{admin_note}",
        parse_mode="Markdown",
    )


async def cmd_chatid(update: Any, context: Any):
    """Returns the current chat ID — useful for configuring ADMIN_CHAT_ID in .env."""
    chat_id = update.effective_chat.id
    chat_type = update.effective_chat.type
    await update.message.reply_text(
        f"📋 *Your Chat Information*\n\n"
        f"Chat ID: `{chat_id}`\n"
        f"Chat Type: `{chat_type}`\n\n"
        f"Copy this Chat ID and set it as `ADMIN_CHAT_ID` in your `.env` file to receive alert cards here.",
        parse_mode="Markdown",
    )


async def cmd_status(update: Any, context: Any):
    """Returns health status of the bot and backend connectivity."""
    global admin_chat_verified, dispatched_alerts

    # Test backend connectivity
    backend_ok = False
    backend_count = 0
    try:
        res = requests.get(f"{BACKEND_API_URL}/ai-alerts/pending", timeout=5)
        if res.status_code == 200:
            backend_ok = True
            backend_count = res.json().get("count", 0)
    except Exception:
        pass

    status_icon = "🟢" if backend_ok else "🔴"
    await update.message.reply_text(
        f"📊 *RakshaSetu Bot Status*\n\n"
        f"Admin Chat Verified: {'✅ Yes' if admin_chat_verified else '❌ No (send /start as admin)'}\n"
        f"Alerts Dispatched (session): `{len(dispatched_alerts)}`\n"
        f"Poll Interval: `{POLL_INTERVAL_SECONDS}s`\n\n"
        f"{status_icon} *Backend API:* `{BACKEND_API_URL}`\n"
        f"Pending Alerts in DB: `{backend_count}`",
        parse_mode="Markdown",
    )


async def cmd_pending(update: Any, context: Any):
    """Manually triggers check and sends pending alert cards."""
    alerts = fetch_pending_alerts()
    if not alerts:
        await update.message.reply_text("✅ No pending AI disaster alerts awaiting review.")
        return

    await update.message.reply_text(f"🔍 Found {len(alerts)} pending alert(s). Sending cards...")
    for alert in alerts:
        text = format_alert_card(alert)
        alert_id = str(alert.get("_id") or alert.get("id"))
        keyboard = [
            [
                InlineKeyboardButton("✅ Approve & Broadcast", callback_data=f"approve_{alert_id}"),
                InlineKeyboardButton("❌ Reject Alert", callback_data=f"reject_{alert_id}"),
            ]
        ]
        await update.message.reply_text(
            text=text,
            parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup(keyboard),
        )


def main():
    if not HAS_TELEGRAM_LIB:
        print("=" * 60)
        print("  ℹ️  'python-telegram-bot' package not yet installed.")
        print("  Install via: pip install 'python-telegram-bot>=20.7'")
        print("=" * 60)
        print("\nChecking pending backend alerts (mock / test mode)...")
        alerts = fetch_pending_alerts()
        print(f"Backend has {len(alerts)} pending alerts awaiting operator review.")
        for a in alerts[:5]:
            print(f"  - [{a.get('recommendedSeverity')}] {a.get('hazardType')} in {a.get('district')} (Score: {a.get('score')})")
        return

    if not TELEGRAM_BOT_TOKEN or not ADMIN_CHAT_ID:
        print("=" * 60)
        print("  ⚠️  TELEGRAM_BOT_TOKEN or ADMIN_CHAT_ID not configured in .env")
        print("=" * 60)
        print("To enable Telegram governance:")
        print("  1. Create a bot with @BotFather on Telegram")
        print("  2. Set TELEGRAM_BOT_TOKEN=<your_token> in ai-service/.env")
        print("  3. Set ADMIN_CHAT_ID=<your_chat_id> in ai-service/.env")
        print("=" * 60)
        # Running demonstration polling check
        print("\nChecking pending backend alerts (mock run)...")
        alerts = fetch_pending_alerts()
        print(f"Backend has {len(alerts)} pending alerts awaiting operator review.")
        for a in alerts[:3]:
            print(f"  - [{a.get('recommendedSeverity')}] {a.get('hazardType')} in {a.get('district')} (Score: {a.get('score')})")
        return

    logger.info("Starting Telegram Early Warning Bot...")
    # Use custom HTTPX request with 30s timeouts to prevent premature dropouts
    t_request = HTTPXRequest(
        connect_timeout=30.0,
        read_timeout=30.0,
        write_timeout=30.0,
        pool_timeout=30.0,
        connection_pool_size=16,
    )
    app = Application.builder().token(TELEGRAM_BOT_TOKEN).request(t_request).build()

    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("pending", cmd_pending))
    app.add_handler(CommandHandler("chatid", cmd_chatid))
    app.add_handler(CommandHandler("status", cmd_status))
    app.add_handler(CallbackQueryHandler(handle_decision_callback))

    # Repeating job to poll pending alerts
    if app.job_queue:
        app.job_queue.run_repeating(
            dispatch_pending_job,
            interval=POLL_INTERVAL_SECONDS,
            first=5,
            data={"admin_chat_id": ADMIN_CHAT_ID},
        )
    else:
        logger.warning("JobQueue not initialized. Background polling disabled.")

    logger.info(f"Bot listening... (Polling every {POLL_INTERVAL_SECONDS}s, Admin Chat ID: {ADMIN_CHAT_ID})")
    app.run_polling(
        bootstrap_retries=10,
        timeout=25,
        drop_pending_updates=True,
    )



if __name__ == "__main__":
    main()

