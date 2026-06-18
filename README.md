# Plugus 🔌

> **YOUR LOCAL SERVICES, PLUGGED IN**

Plugus is a robust, premium marketplace platform connecting local customers with reliable home service vendors (e.g., Electricians, Plumbers, Housecleaning, and Laundry). 

The platform supports a sophisticated multi-role architecture, allowing Super Admins to manage the overall platform, City Admins to moderate local vendors, Vendors to manage their service catalogs, and Customers to easily book services and leave reviews.

## 🚀 Tech Stack
- **Framework:** [Expo](https://expo.dev/) / React Native
- **Routing:** Expo Router
- **Backend & Database:** [Supabase](https://supabase.com/) (PostgreSQL, Edge Functions, Row-Level Security)
- **Animations:** React Native Reanimated

## ✨ Key Features
- **Multi-Role Authentication:** Securely log in as a Super Admin, City Admin, Vendor, or Customer.
- **Customer App:** Browse verified local vendors by city and category, book services, track order statuses, and submit 5-star reviews or complaints.
- **Vendor Dashboard:** Publish service catalogs, manage pricing, and seamlessly accept/reject incoming customer bookings.
- **City Admin Dashboard:** Manage and approve/reject new vendor applications for a specific city.
- **Super Admin Dashboard:** Global oversight and the ability to securely generate new City Admin accounts via rate-limit-bypassing Edge Functions.

## 🛠️ Getting Started

### 1. Prerequisites
- Node.js (v18+)
- Supabase CLI (for backend deployment)

### 2. Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/vaishnavinfosis-creator/final.git
cd final
npm install
```

### 3. Environment Variables
Create a `.env` file in the root directory and add your Supabase credentials. **(Never commit this file)**
```env
EXPO_PUBLIC_SUPABASE_URL=your-supabase-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 4. Database Setup
The database schema and policies are provided in the `/supabase` folder. 
1. Link your Supabase project: `npx supabase link --project-ref your-project-id`
2. Push the schema: `npx supabase db push` (or manually run `schema.sql` and `seed.sql` in your Supabase SQL editor).
3. Deploy Edge Functions: `npx supabase functions deploy create-admin`

### 5. Run the App
Start the Expo development server:
```bash
npx expo start -c
```
Press `a` to open in Android emulator, or `i` to open in iOS simulator.

---
*Built with ❤️ for connecting local communities to reliable services.*
