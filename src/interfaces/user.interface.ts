export type Language = 'ENG' | 'BN';
export type MeasurementUnit = 'kilometers' | 'meters' | 'miles';

export interface AppPreferences {
  preferredLanguage: Language;
  measurementUnits: MeasurementUnit;
  dataSavingMode: boolean;
}

export interface SecuritySettings {
  twoFactorAuthentication: boolean;
  loginNotifications: boolean;
  activeSessions: string[];
}

export interface NotificationChannels {
  email: boolean;
  sms: boolean;
  push: boolean;
}

export interface NotificationTypes {
  weatherAlerts: boolean;
  diseaseOutbreaks: boolean;
  marketPrices: boolean;
  systemUpdates: boolean;
  tipsAndRecommendations: boolean;
}

export interface NotificationSettings {
  channels: NotificationChannels;
  types: NotificationTypes;
}

export interface PrivacySettings {
  profileVisibility: {
    showToOtherFarmers: boolean;
    showLocationOnMap: boolean;
  };
  dataUsage: {
    shareAnonymousFarmingData: boolean;
    personalizedRecommendations: boolean;
  };
}

export interface ConnectedAccounts {
  facebook?: string;
  phoneNumber?: string;
  google?: string;
}

export interface AccountSettings {
  securitySettings: SecuritySettings;
  notificationSettings: NotificationSettings;
  privacySettings: PrivacySettings;
  connectedAccounts: ConnectedAccounts;
}

export interface IUser {
  _id?: string;
  name: string;
  occupation: string;
  location: string;
  email: string;
  phoneNumber: string;
  gender: string;
  dateOfBirth: Date;
  appPreferences: AppPreferences;
  accountSettings: AccountSettings;
  createdAt?: Date;
  updatedAt?: Date;
}
