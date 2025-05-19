import mongoose, { model, models } from 'mongoose';
import { IUser } from '../interfaces/user.interface';

// ENUM constants
const LANGUAGE_ENUM = ['ENG', 'BN'];
const MEASUREMENT_UNIT_ENUM = ['kilometers', 'meters', 'miles'];

// Subschemas
const privacySettingsSchema = new mongoose.Schema(
  {
    profileVisibility: {
      showToOtherFarmers: { type: Boolean, default: true },
      showLocationOnMap: { type: Boolean, default: false },
    },
    dataUsage: {
      shareAnonymousFarmingData: { type: Boolean, default: true },
      personalizedRecommendations: { type: Boolean, default: true },
    },
  },
  { _id: false }
);

const securitySettingsSchema = new mongoose.Schema(
  {
    twoFactorAuthentication: { type: Boolean, default: true },
    loginNotifications: { type: Boolean, default: true },
    activeSessions: [{ type: String }],
  },
  { _id: false }
);

const notificationSettingsSchema = new mongoose.Schema(
  {
    channels: {
      email: Boolean,
      sms: Boolean,
      push: Boolean,
    },
    types: {
      weatherAlerts: Boolean,
      diseaseOutbreaks: Boolean,
      marketPrices: Boolean,
      systemUpdates: Boolean,
      tipsAndRecommendations: Boolean,
    },
  },
  { _id: false }
);

const appPreferencesSchema = new mongoose.Schema(
  {
    preferredLanguage: {
      type: String,
      enum: LANGUAGE_ENUM,
      default: 'ENG',
    },
    measurementUnits: {
      type: String,
      enum: MEASUREMENT_UNIT_ENUM,
      default: 'kilometers',
    },
    dataSavingMode: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false }
);

const connectedAccountsSchema = new mongoose.Schema(
  {
    facebook: String,
    phoneNumber: String,
    google: String,
  },
  { _id: false }
);

const userSchema = new mongoose.Schema<IUser>(
  {
    name: String,
    occupation: String,
    location: String,
    email: { type: String, unique: true },
    phoneNumber: String,
    gender: String,
    dateOfBirth: Date,

    appPreferences: appPreferencesSchema,

    accountSettings: {
      securitySettings: securitySettingsSchema,
      notificationSettings: notificationSettingsSchema,
      privacySettings: privacySettingsSchema,
      connectedAccounts: connectedAccountsSchema,
    },
  },
  { timestamps: true }
);

export const User = models.User || model<IUser>('User', userSchema);
