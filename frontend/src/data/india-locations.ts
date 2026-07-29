/** Indian States, Union Territories, and major cities for cascading location selects. */

export type IndiaState = {
  name: string
  cities: string[]
}

export const INDIA_STATES: IndiaState[] = [
  {
    name: "Andaman and Nicobar Islands",
    cities: ["Port Blair", "Diglipur", "Mayabunder", "Car Nicobar", "Havelock"],
  },
  {
    name: "Andhra Pradesh",
    cities: [
      "Visakhapatnam",
      "Vijayawada",
      "Guntur",
      "Nellore",
      "Kurnool",
      "Rajahmundry",
      "Tirupati",
      "Kakinada",
      "Anantapur",
      "Eluru",
      "Ongole",
      "Kadapa",
    ],
  },
  {
    name: "Arunachal Pradesh",
    cities: ["Itanagar", "Naharlagun", "Tawang", "Pasighat", "Ziro", "Bomdila"],
  },
  {
    name: "Assam",
    cities: [
      "Guwahati",
      "Dibrugarh",
      "Silchar",
      "Jorhat",
      "Nagaon",
      "Tinsukia",
      "Tezpur",
      "Bongaigaon",
    ],
  },
  {
    name: "Bihar",
    cities: [
      "Patna",
      "Gaya",
      "Bhagalpur",
      "Muzaffarpur",
      "Purnia",
      "Darbhanga",
      "Bihar Sharif",
      "Ara",
      "Begusarai",
      "Katihar",
    ],
  },
  {
    name: "Chandigarh",
    cities: ["Chandigarh"],
  },
  {
    name: "Chhattisgarh",
    cities: [
      "Raipur",
      "Bhilai",
      "Bilaspur",
      "Korba",
      "Durg",
      "Rajnandgaon",
      "Raigarh",
      "Jagdalpur",
    ],
  },
  {
    name: "Dadra and Nagar Haveli and Daman and Diu",
    cities: ["Daman", "Diu", "Silvassa", "Amli"],
  },
  {
    name: "Delhi",
    cities: [
      "New Delhi",
      "Central Delhi",
      "South Delhi",
      "North Delhi",
      "East Delhi",
      "West Delhi",
      "Dwarka",
      "Rohini",
      "Saket",
      "Karol Bagh",
    ],
  },
  {
    name: "Goa",
    cities: ["Panaji", "Margao", "Vasco da Gama", "Mapusa", "Ponda", "Calangute"],
  },
  {
    name: "Gujarat",
    cities: [
      "Ahmedabad",
      "Surat",
      "Vadodara",
      "Rajkot",
      "Bhavnagar",
      "Jamnagar",
      "Gandhinagar",
      "Junagadh",
      "Anand",
      "Morbi",
      "Nadiad",
      "Bharuch",
    ],
  },
  {
    name: "Haryana",
    cities: [
      "Gurugram",
      "Faridabad",
      "Panipat",
      "Ambala",
      "Hisar",
      "Karnal",
      "Rohtak",
      "Sonipat",
      "Yamunanagar",
      "Panchkula",
    ],
  },
  {
    name: "Himachal Pradesh",
    cities: [
      "Shimla",
      "Dharamshala",
      "Mandi",
      "Solan",
      "Kullu",
      "Manali",
      "Hamirpur",
      "Bilaspur",
      "Una",
    ],
  },
  {
    name: "Jammu and Kashmir",
    cities: ["Srinagar", "Jammu", "Anantnag", "Baramulla", "Udhampur", "Kathua", "Sopore"],
  },
  {
    name: "Jharkhand",
    cities: [
      "Ranchi",
      "Jamshedpur",
      "Dhanbad",
      "Bokaro",
      "Deoghar",
      "Hazaribagh",
      "Giridih",
      "Phusro",
    ],
  },
  {
    name: "Karnataka",
    cities: [
      "Bengaluru",
      "Mysuru",
      "Mangaluru",
      "Hubballi",
      "Belagavi",
      "Kalaburagi",
      "Davangere",
      "Ballari",
      "Shivamogga",
      "Tumakuru",
      "Udupi",
      "Vijayapura",
    ],
  },
  {
    name: "Kerala",
    cities: [
      "Thiruvananthapuram",
      "Kochi",
      "Kozhikode",
      "Thrissur",
      "Kollam",
      "Kannur",
      "Alappuzha",
      "Palakkad",
      "Malappuram",
      "Kottayam",
    ],
  },
  {
    name: "Ladakh",
    cities: ["Leh", "Kargil", "Nubra", "Diskit"],
  },
  {
    name: "Lakshadweep",
    cities: ["Kavaratti", "Agatti", "Minicoy", "Amini"],
  },
  {
    name: "Madhya Pradesh",
    cities: [
      "Bhopal",
      "Indore",
      "Gwalior",
      "Jabalpur",
      "Ujjain",
      "Sagar",
      "Dewas",
      "Satna",
      "Ratlam",
      "Rewa",
    ],
  },
  {
    name: "Maharashtra",
    cities: [
      "Mumbai",
      "Pune",
      "Nagpur",
      "Nashik",
      "Thane",
      "Aurangabad",
      "Solapur",
      "Amravati",
      "Kolhapur",
      "Navi Mumbai",
      "Kalyan",
      "Sangli",
    ],
  },
  {
    name: "Manipur",
    cities: ["Imphal", "Thoubal", "Bishnupur", "Churachandpur", "Ukhrul"],
  },
  {
    name: "Meghalaya",
    cities: ["Shillong", "Tura", "Jowai", "Nongpoh", "Baghmara"],
  },
  {
    name: "Mizoram",
    cities: ["Aizawl", "Lunglei", "Champhai", "Serchhip", "Kolasib"],
  },
  {
    name: "Nagaland",
    cities: ["Kohima", "Dimapur", "Mokokchung", "Tuensang", "Wokha"],
  },
  {
    name: "Odisha",
    cities: [
      "Bhubaneswar",
      "Cuttack",
      "Rourkela",
      "Berhampur",
      "Sambalpur",
      "Puri",
      "Balasore",
      "Bhadrak",
    ],
  },
  {
    name: "Puducherry",
    cities: ["Puducherry", "Karaikal", "Mahe", "Yanam"],
  },
  {
    name: "Punjab",
    cities: [
      "Ludhiana",
      "Amritsar",
      "Jalandhar",
      "Patiala",
      "Bathinda",
      "Mohali",
      "Pathankot",
      "Hoshiarpur",
      "Moga",
      "Batala",
    ],
  },
  {
    name: "Rajasthan",
    cities: [
      "Jaipur",
      "Jodhpur",
      "Udaipur",
      "Kota",
      "Ajmer",
      "Bikaner",
      "Alwar",
      "Bhilwara",
      "Sikar",
      "Bharatpur",
    ],
  },
  {
    name: "Sikkim",
    cities: ["Gangtok", "Namchi", "Gyalshing", "Mangan", "Rangpo"],
  },
  {
    name: "Tamil Nadu",
    cities: [
      "Chennai",
      "Coimbatore",
      "Madurai",
      "Tiruchirappalli",
      "Salem",
      "Tirunelveli",
      "Erode",
      "Vellore",
      "Thoothukudi",
      "Thanjavur",
      "Dindigul",
      "Hosur",
    ],
  },
  {
    name: "Telangana",
    cities: [
      "Hyderabad",
      "Warangal",
      "Nizamabad",
      "Khammam",
      "Karimnagar",
      "Ramagundam",
      "Mahbubnagar",
      "Nalgonda",
      "Adilabad",
      "Siddipet",
    ],
  },
  {
    name: "Tripura",
    cities: ["Agartala", "Udaipur", "Dharmanagar", "Kailashahar", "Belonia"],
  },
  {
    name: "Uttar Pradesh",
    cities: [
      "Lucknow",
      "Kanpur",
      "Ghaziabad",
      "Agra",
      "Varanasi",
      "Meerut",
      "Prayagraj",
      "Noida",
      "Bareilly",
      "Aligarh",
      "Moradabad",
      "Saharanpur",
      "Gorakhpur",
      "Jhansi",
    ],
  },
  {
    name: "Uttarakhand",
    cities: [
      "Dehradun",
      "Haridwar",
      "Roorkee",
      "Haldwani",
      "Rudrapur",
      "Kashipur",
      "Rishikesh",
      "Nainital",
    ],
  },
  {
    name: "West Bengal",
    cities: [
      "Kolkata",
      "Howrah",
      "Durgapur",
      "Asansol",
      "Siliguri",
      "Kharagpur",
      "Bardhaman",
      "Malda",
      "Haldia",
      "Darjeeling",
    ],
  },
]

export function getCitiesForState(stateName: string): string[] {
  const match = INDIA_STATES.find((s) => s.name === stateName)
  return match?.cities ?? []
}

/** Parse stored location strings like "Bengaluru, Karnataka" or free text. */
export function parseLocation(raw: string | null | undefined): {
  state: string
  city: string
} {
  const value = (raw || "").trim()
  if (!value) return { state: "", city: "" }

  for (const state of INDIA_STATES) {
    if (value === state.name) return { state: state.name, city: "" }
    if (value.endsWith(`, ${state.name}`)) {
      const city = value.slice(0, value.length - `, ${state.name}`.length).trim()
      if (state.cities.includes(city) || city) {
        return { state: state.name, city }
      }
    }
    for (const city of state.cities) {
      if (value === city || value === `${city}, ${state.name}`) {
        return { state: state.name, city }
      }
    }
  }

  // Fallback: "City, State" split
  const parts = value.split(",").map((p) => p.trim()).filter(Boolean)
  if (parts.length >= 2) {
    const maybeState = parts[parts.length - 1]
    const stateMatch = INDIA_STATES.find(
      (s) => s.name.toLowerCase() === maybeState.toLowerCase()
    )
    if (stateMatch) {
      return { state: stateMatch.name, city: parts.slice(0, -1).join(", ") }
    }
  }

  return { state: "", city: "" }
}

export function formatLocation(state: string, city: string): string {
  if (city && state) return `${city}, ${state}`
  if (state) return state
  if (city) return city
  return ""
}
