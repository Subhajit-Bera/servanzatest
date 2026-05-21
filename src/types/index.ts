export interface User {
  id: string;
  name: string;
  email?: string;
  phone: string;
  profileImage?: string;
  isVerified: boolean;
  verifiedAt?: string;
  role: 'USER' | 'BUDDY' | 'ADMIN';

  // Profile Fields
  skills?: string[];
  dob?: string;
  whatsapp?: string;
  secondaryPhone?: string;
  bloodGroup?: string;
  city?: string;
  permanentAddress?: string;
  currentAddress?: string;
  languages?: string[];

  // Progress Tracking Objects
  bankDetails?: {
    accountNumber?: string;
    ifscCode?: string;
    accountHolderName?: string;
    bankName?: string;
    bankDocument?: string; // For cancelled check/passbook upload
  };
  bankDetailsMethod?: 'ACCOUNT_DETAILS' | 'DOCUMENT_UPLOAD';

  emergencyContact?: {
    name?: string;
    phone?: string;
    relationship?: string;
  };

  // Consolidated Documents Object
  // Stores the URL of the uploaded document. If the string exists, it is considered "uploaded".
  documents?: {
    aadhaarFront?: string;
    aadhaarBack?: string;
    pan?: string;
    bankDocument?: string;
  };

  // Verification status
  verificationStatus?: BuddyVerificationStatus;

  // Training fields
  trainingStartDate?: string;
  trainingDaysTaken?: number;
  isTrainingCompleted?: boolean;
  jobStartDate?: string; // Assigned by admin
}

export interface BuddyVerificationStatus {
  aadhaarFront: { verified: boolean; comment: string | null };
  aadhaarBack: { verified: boolean; comment: string | null };
  pan: { verified: boolean; comment: string | null };
  bankDetails: { verified: boolean; comment: string | null };
  emergencyContact: { verified: boolean; comment: string | null };
  allVerified: boolean;
}


export interface Address {
  id: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
}

export interface Service {
  id: string;
  title: string;
  description?: string;
}

export interface Job {
  id: string;
  status: 'PENDING' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  scheduledStart: string;
  user: User;
  service: Service;
  address: Address;
  price: number;
  assignments: {
    id: string;
    status: string;
  }[];
}

export interface AuthState {
  token: string | null;
  isAuthenticated: boolean;
  user: User | null;
  loading: boolean;
  error: string | null;
}

export interface EarningsPeriod {
  amount: number;
  count: number;
}

export interface EarningsSummary {
  totalEarnings: number;
  pendingAmount?: number;
  totalPaid?: number;
  totalJobs: number;
  today: EarningsPeriod;
  thisWeek: EarningsPeriod;
  thisMonth: EarningsPeriod;
}

export interface Review {
  id: string;
  rating: number;
  comment?: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    profileImage?: string;
  };
  booking: {
    id: string;
    service: {
      title: string;
    };
  };
}