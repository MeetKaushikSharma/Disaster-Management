import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Info, MapPin, CheckCircle } from 'lucide-react';
import { createEvent, triggerAlert, getGuides } from '../api/services';
import ZoneMap, { type ZoneData } from '../components/ZoneMap';
import type { DisasterType, Severity, ZoneType, SafetyGuide, EventStatus } from '../types';

const DISASTER_TYPES: DisasterType[] = [
  'Flood', 'FlashFlood', 'HeavyRainfall', 'UrbanWaterlogging',
  'Cyclone', 'Landslide', 'Heatwave', 'Coldwave',
  'Earthquake', 'Fire', 'Tsunami', 'Drought', 'ChemicalSpill', 'Other',
];

const SEVERITY_LEVELS: Severity[] = ['Low', 'Medium', 'High', 'Critical'];

const INDIA_STATES = [
  { name: 'Andhra Pradesh', districts: ['Anantapur', 'Chittoor', 'East Godavari', 'Guntur', 'Kadapa', 'Krishna', 'Kurnool', 'Nellore', 'Prakasam', 'Srikakulam', 'Visakhapatnam', 'Vizianagaram', 'West Godavari'] },
  { name: 'Arunachal Pradesh', districts: ['Anjaw', 'Changlang', 'Dibang Valley', 'East Kameng', 'East Siang', 'Kamle', 'Kra Daadi', 'Kurung Kumey', 'Lohit', 'Longding', 'Lower Dibang Valley', 'Lower Siang', 'Lower Subansiri', 'Namsai', 'Pakke-Kessang', 'Papum Pare', 'Shi Yomi', 'Siang', 'Tawang', 'Tirap', 'Upper Dibang Valley', 'Upper Siang', 'Upper Subansiri', 'West Kameng', 'West Siang'] },
  { name: 'Assam', districts: ['Baksa', 'Barpeta', 'Biswanath', 'Bongaigaon', 'Cachar', 'Charaideo', 'Chirang', 'Darrang', 'Dhemaji', 'Dhubri', 'Dibrugarh', 'Dima Hasao', 'Goalpara', 'Golaghat', 'Hailakandi', 'Hojai', 'Jorhat', 'Kamrup Metropolitan', 'Kamrup Rural', 'Karbi Anglong', 'Karimganj', 'Kokrajhar', 'Lakhimpur', 'Majuli', 'Morigaon', 'Nagaon', 'Nalbari', 'Sivasagar', 'Sonitpur', 'South Salmara-Mankachar', 'Tinsukia', 'Udalguri', 'West Karbi Anglong'] },
  { name: 'Bihar', districts: ['Araria', 'Arwal', 'Aurangabad', 'Banka', 'Begusarai', 'Bhagalpur', 'Bhojpur', 'Buxar', 'Darbhanga', 'East Champaran', 'Gaya', 'Gopalganj', 'Jamui', 'Jehanabad', 'Kaimur', 'Katihar', 'Khagaria', 'Kishanganj', 'Lakhisarai', 'Madhepura', 'Madhubani', 'Munger', 'Muzaffarpur', 'Nalanda', 'Nawada', 'Patna', 'Purnia', 'Rohtas', 'Saharsa', 'Samastipur', 'Saran', 'Sheikhpura', 'Sheohar', 'Sitamarhi', 'Siwan', 'Supaul', 'Vaishali', 'West Champaran'] },
  { name: 'Chhattisgarh', districts: ['Balod', 'Baloda Bazar', 'Balrampur', 'Bastar', 'Bemetara', 'Bijapur', 'Bilaspur', 'Dantewada', 'Dhamtari', 'Durg', 'Gariaband', 'Gaurela-Pendra-Marwahi', 'Janjgir-Champa', 'Jashpur', 'Kabirdham', 'Kanker', 'Kondagaon', 'Korba', 'Koriya', 'Mahasamund', 'Mungeli', 'Narayanpur', 'Raigarh', 'Raipur', 'Rajnandgaon', 'Sarangarh-Bilaigarh', 'Sukma', 'Surajpur', 'Surguja'] },
  { name: 'Goa', districts: ['North Goa', 'South Goa'] },
  { name: 'Gujarat', districts: ['Ahmedabad', 'Amreli', 'Anand', 'Aravalli', 'Banaskantha', 'Bharuch', 'Bhavnagar', 'Botad', 'Chhota Udaipur', 'Dahod', 'Dang', 'Devbhoomi Dwarka', 'Gandhinagar', 'Gir Somnath', 'Jamnagar', 'Junagadh', 'Kheda', 'Kutch', 'Mahisagar', 'Mehsana', 'Modasa', 'Morbi', 'Narmada', 'Navsari', 'Panchmahal', 'Patan', 'Porbandar', 'Rajkot', 'Sabarkantha', 'Surat', 'Surendranagar', 'Tapi', 'Vadodara', 'Valsad'] },
  { name: 'Haryana', districts: ['Ambala', 'Bhiwani', 'Charkhi Dadri', 'Faridabad', 'Fatehabad', 'Gurugram', 'Hisar', 'Jhajjar', 'Jind', 'Kaithal', 'Karnal', 'Kurukshetra', 'Mahendragarh', 'Nuh', 'Palwal', 'Panchkula', 'Panipat', 'Rewari', 'Rohtak', 'Sirsa', 'Sonipat', 'Yamunanagar'] },
  { name: 'Himachal Pradesh', districts: ['Bilaspur', 'Chamba', 'Hamirpur', 'Kangra', 'Kinnaur', 'Kullu', 'Lahaul and Spiti', 'Mandi', 'Shimla', 'Sirmaur', 'Solan', 'Una'] },
  { name: 'Jharkhand', districts: ['Bokaro', 'Chatra', 'Deoghar', 'Dhanbad', 'Dumka', 'East Singhbhum', 'Garhwa', 'Giridih', 'Godda', 'Gumla', 'Hazaribagh', 'Jamtara', 'Khunti', 'Koderma', 'Latehar', 'Lohardaga', 'Pakur', 'Palamu', 'Ramgarh', 'Ranchi', 'Sahibganj', 'Saraikela-Kharsawan', 'Simdega', 'West Singhbhum'] },
  { name: 'Karnataka', districts: ['Bagalkot', 'Ballari', 'Belagavi', 'Bengaluru Rural', 'Bengaluru Urban', 'Bidar', 'Chamarajanagar', 'Chikkaballapur', 'Chikkamagaluru', 'Chitradurga', 'Dakshina Kannada', 'Davanagere', 'Dharwad', 'Gadag', 'Hassan', 'Haveri', 'Kalaburagi', 'Kodagu', 'Kolar', 'Koppal', 'Mandya', 'Mysuru', 'Raichur', 'Ramanagara', 'Shivamogga', 'Tumakuru', 'Udupi', 'Uttara Kannada', 'Vijayanagara', 'Vijayapura', 'Yadgir'] },
  { name: 'Kerala', districts: ['Alappuzha', 'Ernakulam', 'Idukki', 'Kannur', 'Kasaragod', 'Kollam', 'Kottayam', 'Kozhikode', 'Malappuram', 'Palakkad', 'Pathanamthitta', 'Thiruvananthapuram', 'Thrissur', 'Wayanad'] },
  { name: 'Madhya Pradesh', districts: ['Agar Malwa', 'Alirajpur', 'Anuppur', 'Ashoknagar', 'Balaghat', 'Barwani', 'Betul', 'Bhind', 'Bhopal', 'Burhanpur', 'Chhatarpur', 'Chhindwara', 'Damoh', 'Datia', 'Dewas', 'Dhar', 'Dindori', 'Guna', 'Gwalior', 'Harda', 'Hoshangabad', 'Indore', 'Jabalpur', 'Jhabua', 'Katni', 'Khandwa', 'Khargone', 'Mandla', 'Mandsaur', 'Morena', 'Narsinghpur', 'Neemuch', 'Panna', 'Raisen', 'Rajgarh', 'Ratlam', 'Rewa', 'Sagar', 'Satna', 'Sehore', 'Seoni', 'Shahdol', 'Shajapur', 'Sheopur', 'Shivpuri', 'Sidhi', 'Singrauli', 'Tikamgarh', 'Ujjain', 'Umaria', 'Vidisha'] },
  { name: 'Maharashtra', districts: ['Ahmednagar', 'Akola', 'Amravati', 'Aurangabad', 'Beed', 'Bhandara', 'Buldhana', 'Chandrapur', 'Dhule', 'Gadchiroli', 'Gondia', 'Hingoli', 'Jalgaon', 'Jalna', 'Kolhapur', 'Latur', 'Mumbai City', 'Mumbai Suburban', 'Nagpur', 'Nanded', 'Nandurbar', 'Nashik', 'Osmanabad', 'Palghar', 'Parbhani', 'Pune', 'Raigad', 'Ratnagiri', 'Sangli', 'Satara', 'Sindhudurg', 'Solapur', 'Thane', 'Wardha', 'Washim', 'Yavatmal'] },
  { name: 'Manipur', districts: ['Bishnupur', 'Chandel', 'Churachandpur', 'Imphal East', 'Imphal West', 'Jiribam', 'Kakching', 'Kamjong', 'Kangpokpi', 'Noney', 'Pherzawl', 'Senapati', 'Tamenglong', 'Tengnoupal', 'Thoubal', 'Ukhrul'] },
  { name: 'Meghalaya', districts: ['East Garo Hills', 'East Jaintia Hills', 'East Khasi Hills', 'North Garo Hills', 'Ri-Bhoi', 'South Garo Hills', 'South West Garo Hills', 'South West Khasi Hills', 'West Garo Hills', 'West Jaintia Hills', 'West Khasi Hills'] },
  { name: 'Mizoram', districts: ['Aizawl', 'Champhai', 'Hnahthial', 'Kolasib', 'Lawngtlai', 'Lunglei', 'Mamit', 'Saiha', 'Saitual', 'Serchhip'] },
  { name: 'Nagaland', districts: ['Chumoukedima', 'Dimapur', 'Kiphire', 'Kohima', 'Longleng', 'Mokokchung', 'Mon', 'Niuland', 'Peren', 'Phek', 'Phomg', 'Tuensang', 'Tseminyu', 'Wokha', 'Zunheboto'] },
  { name: 'Odisha', districts: ['Angul', 'Balangir', 'Balasore', 'Bargarh', 'Bhadrak', 'Boudh', 'Cuttack', 'Debagarh', 'Dhenkanal', 'Gajapati', 'Ganjam', 'Jagatsinghpur', 'Jajpur', 'Jharsuguda', 'Kalahandi', 'Kandhamal', 'Kendrapara', 'Kendujhar', 'Khordha', 'Koraput', 'Malkangiri', 'Mayurbhanj', 'Nabarangpur', 'Nayagarh', 'Nuapada', 'Puri', 'Rayagada', 'Sambalpur', 'Sonepur', 'Sundargarh'] },
  { name: 'Punjab', districts: ['Amritsar', 'Barnala', 'Bathinda', 'Faridkot', 'Fatehgarh Sahib', 'Fazilka', 'Ferozepur', 'Gurdaspur', 'Hoshiarpur', 'Jalandhar', 'Kapurthala', 'Ludhiana', 'Mansa', 'Moga', 'Mohali', 'Muktsar', 'Pathankot', 'Patiala', 'Rupnagar', 'Sahibzada Ajit Singh Nagar', 'Sangrur', 'Tarn Taran'] },
  { name: 'Rajasthan', districts: ['Ajmer', 'Alwar', 'Anupgarh', 'Balotra', 'Banswara', 'Baran', 'Barmer', 'Beawar', 'Bikaner', 'Bundi', 'Chittorgarh', 'Churu', 'Dausa', 'Deeg', 'Dholpur', 'Didwana-Kuchaman', 'Dudu', 'Ganganagar', 'Gangapur City', 'Hanumangarh', 'Jaipur', 'Jaisalmer', 'Jalore', 'Jhalawar', 'Jhunjhunu', 'Jodhpur', 'Karauli', 'Kekri', 'Khairthal-Tijara', 'Kota', 'Nagaur', 'Neem Ka Thana', 'Pali', 'Phalodi', 'Rajsamand', 'Salumber', 'Sanchore', 'Sawai Madhopur', 'Shahpura', 'Sikar', 'Sirohi', 'Sri Ganganagar', 'Tonk', 'Udaipur'] },
  { name: 'Sikkim', districts: ['East Sikkim', 'North Sikkim', 'South Sikkim', 'West Sikkim'] },
  { name: 'Tamil Nadu', districts: ['Ariyalur', 'Chennai', 'Coimbatore', 'Cuddalore', 'Dharmapuri', 'Dindigul', 'Erode', 'Kallakurichi', 'Kanchipuram', 'Kanyakumari', 'Karur', 'Krishnagiri', 'Madurai', 'Mayiladuthurai', 'Nagapattinam', 'Nilgiris', 'Namakkal', 'Perambalur', 'Pudukkottai', 'Ramanathapuram', 'Ranipet', 'Salem', 'Sivaganga', 'Tenkasi', 'Thanjavur', 'Theni', 'Thiruvallur', 'Thiruvarur', 'Thoothukudi', 'Tirunelveli', 'Tirupathur', 'Tiruppur', 'Tiruvannamalai', 'Trichy', 'Tuticorin', 'Vellore', 'Viluppuram', 'Virudhunagar'] },
  { name: 'Telangana', districts: ['Adilabad', 'Bhadradri Kothagudem', 'Hyderabad', 'Jagitial', 'Jangoan', 'Jayashankar Bhupalpally', 'Jogulamba Gadwal', 'Kamareddy', 'Karimnagar', 'Khammam', 'Komaram Bheem Asifabad', 'Mahabubabad', 'Mahabubnagar', 'Mancherial', 'Medak', 'Medchal-Malkajgiri', 'Mulugu', 'Nagarkurnool', 'Nalgonda', 'Narayanpet', 'Nirmal', 'Nizamabad', 'Peddapalli', 'Rajanna Sircilla', 'Ranga Reddy', 'Sangareddy', 'Siddipet', 'Suryapet', 'Vikarabad', 'Wanaparthy', 'Warangal Rural', 'Warangal Urban', 'Yadadri Bhuvanagiri'] },
  { name: 'Tripura', districts: ['Dhalai', 'Gomati', 'Khowai', 'North Tripura', 'Sepahijala', 'South Tripura', 'Unakoti', 'West Tripura'] },
  { name: 'Uttar Pradesh', districts: ['Agra', 'Aligarh', 'Ambedkar Nagar', 'Amethi', 'Amroha', 'Ayodhya', 'Azamgarh', 'Baghpat', 'Bahraich', 'Ballia', 'Balrampur', 'Banda', 'Barabanki', 'Bareilly', 'Basti', 'Bhadohi', 'Bijnor', 'Budaun', 'Bulandshahr', 'Chandauli', 'Chitrakoot', 'Deoria', 'Etah', 'Etawah', 'Farrukhabad', 'Fatehpur', 'Firozabad', 'Gautam Buddha Nagar', 'Ghaziabad', 'Ghazipur', 'Gonda', 'Gorakhpur', 'Hamirpur', 'Hapur', 'Hardoi', 'Hathras', 'Jalaun', 'Jaunpur', 'Jhansi', 'Kannauj', 'Kanpur Dehat', 'Kanpur Nagar', 'Kasganj', 'Kaushambi', 'Kheri', 'Kushinagar', 'Lalitpur', 'Lucknow', 'Maharajganj', 'Mahoba', 'Mainpuri', 'Mathura', 'Mau', 'Meerut', 'Mirzapur', 'Moradabad', 'Muzaffarnagar', 'Pilibhit', 'Pratapgarh', 'Prayagraj', 'Raebareli', 'Rampur', 'Saharanpur', 'Sambhal', 'Sant Kabir Nagar', 'Shahjahanpur', 'Shamli', 'Shravasti', 'Siddharthnagar', 'Sitapur', 'Sonbhadra', 'Sultanpur', 'Unnao', 'Varanasi'] },
  { name: 'Uttarakhand', districts: ['Almora', 'Bageshwar', 'Chamoli', 'Champawat', 'Dehradun', 'Haridwar', 'Nainital', 'Pauri Garhwal', 'Pithoragarh', 'Rudraprayag', 'Tehri Garhwal', 'Udham Singh Nagar', 'Uttarkashi'] },
  { name: 'West Bengal', districts: ['Alipurduar', 'Bankura', 'Birbhum', 'Cooch Behar', 'Dakshin Dinajpur', 'Darjeeling', 'Hooghly', 'Howrah', 'Jalpaiguri', 'Jhargram', 'Kalimpong', 'Kolkata', 'Malda', 'Murshidabad', 'Nadia', 'North 24 Parganas', 'Paschim Bardhaman', 'Paschim Medinipur', 'Purba Bardhaman', 'Purba Medinipur', 'Purulia', 'South 24 Parganas', 'Uttar Dinajpur'] },
  { name: 'Andaman and Nicobar Islands', districts: ['Nicobar', 'North and Middle Andaman', 'South Andaman'] },
  { name: 'Chandigarh', districts: ['Chandigarh'] },
  { name: 'Dadra and Nagar Haveli and Daman and Diu', districts: ['Dadra and Nagar Haveli', 'Daman', 'Diu'] },
  { name: 'Delhi', districts: ['Central Delhi', 'East Delhi', 'New Delhi', 'North Delhi', 'North East Delhi', 'North West Delhi', 'Shahdara', 'South Delhi', 'South East Delhi', 'South West Delhi', 'West Delhi'] },
  { name: 'Jammu and Kashmir', districts: ['Anantnag', 'Bandipora', 'Baramulla', 'Budgam', 'Doda', 'Ganderbal', 'Jammu', 'Kathua', 'Kishtwar', 'Kulgam', 'Kupwara', 'Poonch', 'Pulwama', 'Rajouri', 'Ramban', 'Reasi', 'Samba', 'Shopian', 'Srinagar', 'Udhampur'] },
  { name: 'Ladakh', districts: ['Kargil', 'Leh'] },
  { name: 'Lakshadweep', districts: ['Agatti', 'Amini', 'Andrott', 'Bitra', 'Chetlat', 'Kadmat', 'Kalpeni', 'Kavaratti', 'Kilthan', 'Minicoy'] },
  { name: 'Puducherry', districts: ['Karaikal', 'Mahe', 'Puducherry', 'Yanam'] },
];

export default function NewEventPage() {
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [hindiTitle, setHindiTitle] = useState('');
  const [type, setType] = useState<DisasterType>('Flood');
  const [severity, setSeverity] = useState<Severity>('Medium');
  const [state, setState] = useState('Uttar Pradesh');
  const [district, setDistrict] = useState('Varanasi');
  const [description, setDescription] = useState('');
  const [hindiDesc, setHindiDesc] = useState('');
  const [safetyGuideId, setSafetyGuideId] = useState('');
  const [zoneType, setZoneType] = useState<ZoneType>('radius');
  const [bufferRadiusKm, setBufferRadiusKm] = useState(5);
  const [expiresAt, setExpiresAt] = useState('');
  const [zoneData, setZoneData] = useState<ZoneData | null>(null);

  const [guides, setGuides] = useState<SafetyGuide[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dispatchInfo, setDispatchInfo] = useState<{ eventId: string; usersTargeted: number; alertsSent: number; status: string } | null>(null);

  useEffect(() => {
    getGuides().then((r) => setGuides(r.data.guides)).catch(() => {});
  }, []);

  useEffect(() => {
    const activeState = INDIA_STATES.find((item) => item.name === state) ?? INDIA_STATES[0];
    const nextDistrict = activeState.districts.includes(district) ? district : activeState.districts[0];
    if (nextDistrict !== district) {
      setDistrict(nextDistrict);
    }
  }, [state, district]);

  const filteredGuides = guides.filter((g) => g.disasterType === type && g.isPublished);
  const selectedStateData = INDIA_STATES.find((item) => item.name === state) ?? INDIA_STATES[0];

  const handleSubmit = async (actionStatus: EventStatus) => {
    setError('');
    setDispatchInfo(null);

    if (!zoneData) {
      setError('Please draw a disaster zone on the map before submitting.');
      return;
    }

    if (zoneType === 'polygon' && (!zoneData.polygon || zoneData.polygon.coordinates[0].length < 4)) {
      setError('Polygon must have at least 3 vertices. Double-click the last point to close it.');
      return;
    }

    if (zoneType === 'radius' && (!zoneData.centre || !zoneData.radiusKm)) {
      setError('Please draw a circle on the map by clicking a centre point and dragging outward.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        title,
        type,
        severity,
        district,
        state,
        description,
        translations: {
          hi: {
            title: hindiTitle || undefined,
            description: hindiDesc || undefined,
          },
        },
        safetyGuideId: safetyGuideId || undefined,
        zoneType,
        bufferRadiusKm,
        status: actionStatus,
        expiresAt: expiresAt || undefined,
        ...(zoneType === 'polygon' && { polygon: zoneData.polygon }),
        ...(zoneType === 'radius' && { centre: zoneData.centre, radiusKm: zoneData.radiusKm }),
      };

      const { data: eventData } = await createEvent(payload as any);
      const eventId = eventData.event._id;

      if (actionStatus === 'published' || actionStatus === 'active') {
        try {
          const { data: triggerData } = await triggerAlert(eventId);
          setDispatchInfo({
            eventId,
            status: actionStatus,
            usersTargeted: triggerData.usersTargeted,
            alertsSent: triggerData.alertsSent,
          });
        } catch {
          // Even if trigger fails, event is created
        }
      } else {
        setDispatchInfo({
          eventId,
          status: actionStatus,
          usersTargeted: 0,
          alertsSent: 0,
        });
      }

      setTimeout(() => navigate('/events'), 2500);
    } catch (err: any) {
      const msgs = err.response?.data?.errors?.map((e: any) => e.message).join(', ');
      setError(msgs || err.response?.data?.message || 'Failed to create event');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="topbar">
        <span className="topbar-title">Create Disaster Event (India SDMA)</span>
      </div>

      {dispatchInfo && (
        <div className="alert alert-success new-event-success-banner" aria-live="polite">
          <CheckCircle size={16} />
          <strong>
            {dispatchInfo.status === 'published' ? 'Alert Published & Dispatched!' : 'Event Saved successfully!'}
          </strong>
          &nbsp; Status: <code>{dispatchInfo.status}</code> · Redirecting to events list…
        </div>
      )}

      <div className="page-content new-event-page-shell">
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            handleSubmit('published');
          }}
          className="new-event-form"
        >
          <div className="new-event-form-grid">
            <div className="new-event-column">
              <div className="card new-event-card">
                <div className="new-event-card-header">
                  <div>
                    <h3>Hazard & Regional Target</h3>
                    <p className="new-event-card-subtitle">Define the incident and alert behavior.</p>
                  </div>
                </div>

                {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}

                <div className="new-event-card-stack">
                  <div className="new-event-field-card">
                    <label className="form-label" htmlFor="ev-state">State *</label>
                    <select id="ev-state" className="form-control" value={state} onChange={(e) => setState(e.target.value)}>
                      {INDIA_STATES.map((item) => (
                        <option key={item.name} value={item.name}>{item.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="new-event-field-card">
                    <label className="form-label" htmlFor="ev-district">Target District *</label>
                    <select id="ev-district" className="form-control" value={district} onChange={(e) => setDistrict(e.target.value)}>
                      {selectedStateData.districts.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="card new-event-card">
                <div className="new-event-card-header">
                  <div>
                    <h3>Hazard Classification</h3>
                    <p className="new-event-card-subtitle">Choose the hazard type and alert level.</p>
                  </div>
                </div>

                <div className="new-event-card-stack">
                  <div className="new-event-field-card">
                    <label className="form-label" htmlFor="ev-type">Hazard Taxonomy *</label>
                    <select id="ev-type" className="form-control" value={type} onChange={(e) => setType(e.target.value as DisasterType)}>
                      {DISASTER_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>

                  <div className="new-event-field-card">
                    <label className="form-label" htmlFor="ev-severity">Severity *</label>
                    <select id="ev-severity" className="form-control new-event-severity-select" value={severity} onChange={(e) => setSeverity(e.target.value as Severity)}>
                      {SEVERITY_LEVELS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <div className="form-hint">Sets the local alert intensity for citizen notifications.</div>
                  </div>
                </div>
              </div>

              <div className="card new-event-card">
                <div className="new-event-card-header">
                  <div>
                    <h3>Alert Messaging</h3>
                    <p className="new-event-card-subtitle">Write advisory content for English and Hindi audiences.</p>
                  </div>
                </div>

                <div className="new-event-card-stack">
                  <div className="new-event-field-card">
                    <label className="form-label" htmlFor="ev-title">Title (English) *</label>
                    <input
                      id="ev-title"
                      className="form-control"
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Flash Flood & Waterlogging Warning — Varanasi Riverbanks"
                      maxLength={120}
                    />
                  </div>

                  <div className="new-event-field-card">
                    <label className="form-label" htmlFor="ev-title-hi">Title (Hindi / हिंदी)</label>
                    <input
                      id="ev-title-hi"
                      className="form-control"
                      value={hindiTitle}
                      onChange={(e) => setHindiTitle(e.target.value)}
                      placeholder="उदा. [चेतावनी] वाराणसी में गंगा का जलस्तर चेतावनी बिंदु के पार"
                      maxLength={120}
                    />
                  </div>

                  <div className="new-event-field-card">
                    <label className="form-label" htmlFor="ev-desc">Advisory Details (English)</label>
                    <textarea
                      id="ev-desc"
                      className="form-control new-event-textarea"
                      rows={2}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      maxLength={2000}
                      placeholder="River level is 0.4m above warning mark. Citizens in low-lying ghats must relocate…"
                    />
                  </div>

                  <div className="new-event-field-card">
                    <label className="form-label" htmlFor="ev-desc-hi">Advisory Details (Hindi / हिंदी)</label>
                    <textarea
                      id="ev-desc-hi"
                      className="form-control new-event-textarea"
                      rows={2}
                      value={hindiDesc}
                      onChange={(e) => setHindiDesc(e.target.value)}
                      maxLength={2000}
                      placeholder="निचले इलाकों के निवासी तुरंत सुरक्षित स्थानों पर जाएं और स्थानीय प्रशासन के निर्देशों का पालन करें…"
                    />
                  </div>
                </div>
              </div>

              <div className="card new-event-card">
                <div className="new-event-card-header">
                  <div>
                    <h3>Reference & Dispatch</h3>
                    <p className="new-event-card-subtitle">Guardrail settings and recommended response guide.</p>
                  </div>
                </div>

                <div className="new-event-card-stack">
                  <div className="new-event-field-card">
                    <label className="form-label" htmlFor="ev-guide">Safety Guide</label>
                    <select id="ev-guide" className="form-control" value={safetyGuideId} onChange={(e) => setSafetyGuideId(e.target.value)}>
                      <option value="">— None —</option>
                      {filteredGuides.map((g) => (
                        <option key={g._id} value={g._id}>{g.title} ({g.language.toUpperCase()})</option>
                      ))}
                    </select>
                  </div>

                  <div className="new-event-field-card">
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label" htmlFor="ev-buffer">Buffer Radius (km)</label>
                        <input
                          id="ev-buffer"
                          type="number"
                          className="form-control"
                          min={0}
                          max={100}
                          step={0.5}
                          value={bufferRadiusKm}
                          onChange={(e) => setBufferRadiusKm(Number(e.target.value))}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label" htmlFor="ev-expires">Expires At</label>
                        <input
                          id="ev-expires"
                          type="datetime-local"
                          className="form-control"
                          value={expiresAt}
                          onChange={(e) => setExpiresAt(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card new-event-reference-card">
                <div className="new-event-card-header compact">
                  <div>
                    <h4>Severity Reference</h4>
                    <p className="new-event-card-subtitle compact">Alert behavior by severity level.</p>
                  </div>
                </div>
                <div className="new-event-severity-list">
                  {SEVERITY_LEVELS.map((s) => (
                    <div key={s} className="new-event-severity-row">
                      <span className={`severity-badge ${s}`} style={{ minWidth: 74 }}>{s}</span>
                      <span className="new-event-severity-text">
                        {s === 'Low' && 'Silent notification, default sound'}
                        {s === 'Medium' && 'High-priority, medium buzzer'}
                        {s === 'High' && 'Max priority, loud buzzer'}
                        {s === 'Critical' && 'Full-screen intent, overrides silent mode'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="card new-event-map-card">
              <div className="new-event-map-header">
                <div>
                  <h3>Draw Disaster Geofence</h3>
                  <p className="new-event-card-subtitle">Define the geographical area for the impact zone.</p>
                </div>
              </div>

              <div className="new-event-zone-wrap">
                <label className="form-label">Zone Type</label>
                <div className="zone-toggle">
                  <button type="button" className={`zone-toggle-btn${zoneType === 'radius' ? ' active' : ''}`} onClick={() => setZoneType('radius')}>
                    Radius Circle
                  </button>
                  <button type="button" className={`zone-toggle-btn${zoneType === 'polygon' ? ' active' : ''}`} onClick={() => setZoneType('polygon')}>
                    Arbitrary Polygon
                  </button>
                </div>
              </div>

              <div className="new-event-info-box">
                <MapPin size={13} />
                {zoneType === 'radius'
                  ? `Focusing on ${district}. Click centre on the map and drag outward to define the impact circle.`
                  : 'Click multiple points on the map to define the perimeter. Double-click the last point to close.'}
              </div>

              <div className="new-event-map-meta">Alert Coverage Area</div>
              <ZoneMap zoneType={zoneType} onZoneChange={setZoneData} />

              {zoneData && (
                <div className="alert alert-success new-event-zone-summary" aria-live="polite">
                  <Info size={13} style={{ display: 'inline', marginRight: 6 }} />
                  {zoneType === 'radius'
                    ? `Radius Geofence: ${zoneData.radiusKm} km radius centered at [${zoneData.centre?.coordinates.map((c) => c.toFixed(4)).join(', ')}]`
                    : `Polygon Geofence: ${zoneData.polygon?.coordinates[0].length} boundary vertices`}
                </div>
              )}
            </div>
          </div>

          <div className="new-event-actions">
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/events')}>
              Cancel
            </button>
            <button type="button" className="btn btn-secondary" disabled={loading} onClick={() => handleSubmit('draft')}>
              Save as Draft
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={loading}
              style={{ border: '1.5px solid var(--amber-500)', color: 'var(--amber-800)', background: 'var(--amber-50)' }}
              onClick={() => handleSubmit('pending_approval')}
            >
              Submit for SDMA Approval
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Processing…' : 'Approve & Publish (SDMA)'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

