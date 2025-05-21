import { CallbackError, model, models, Schema } from 'mongoose';
import { IUser } from '../interfaces/user.interface';
import bcrypt from 'bcryptjs';

// ENUM constants
const LANGUAGE_ENUM = ['ENG', 'BN'];
const MEASUREMENT_UNIT_ENUM = ['kilometers', 'meters', 'miles'];
const ROLE_ENUM = ['user', 'admin'];

// Subschemas
const privacySettingsSchema = new Schema(
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

const securitySettingsSchema = new Schema(
  {
    twoFactorAuthentication: { type: Boolean, default: true },
    loginNotifications: { type: Boolean, default: true },
    activeSessions: [{ type: String }],
  },
  { _id: false }
);

const notificationSettingsSchema = new Schema(
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

const appPreferencesSchema = new Schema(
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

const connectedAccountsSchema = new Schema(
  {
    facebook: String,
    phoneNumber: String,
    google: String,
  },
  { _id: false }
);

const userSchema = new Schema<IUser>(
  {
    name: String,
    occupation: String,
    role: { type: String, enum: ROLE_ENUM, default: 'user' },
    location: String,
    email: { type: String, unique: true },
    password: {
      type: String,
      required: true,
    },
    phoneNumber: String,
    gender: String,
    dateOfBirth: Date,
    farm: { type: Schema.ObjectId, ref: 'Farm' },
    activities: [{ type: Schema.Types.ObjectId, ref: 'Activity' }],

    appPreferences: appPreferencesSchema,

    accountSettings: {
      securitySettings: securitySettingsSchema,
      notificationSettings: notificationSettingsSchema,
      privacySettings: privacySettingsSchema,
      connectedAccounts: connectedAccountsSchema,
    },
    cropSuggestionHistories: [Schema.ObjectId],
  },
  { timestamps: true }
);
userSchema.pre('save', async function (next) {
  const user = this as IUser;
  if (!user.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    const hash = bcrypt.hashSync(user.password, salt);

    user.password = hash;
    next();
  } catch (error) {
    next(error as CallbackError);
  }
});

export const User = models.User || model<IUser>('User', userSchema);
