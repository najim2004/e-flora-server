import { CallbackError, model, models, Schema } from 'mongoose';
import { IUser } from '../interfaces/user.interface';
import bcrypt from 'bcryptjs';

// ENUM constants
const LANGUAGE_ENUM = ['ENG', 'BN'] as const;
const MEASUREMENT_UNIT_ENUM = ['kilometers', 'meters', 'miles'] as const;
const ROLE_ENUM = ['user', 'admin'] as const;

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
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
    },
    types: {
      weatherAlerts: { type: Boolean, default: true },
      diseaseOutbreaks: { type: Boolean, default: true },
      marketPrices: { type: Boolean, default: true },
      systemUpdates: { type: Boolean, default: true },
      tipsAndRecommendations: { type: Boolean, default: true },
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
    facebook: { type: String, default: '' },
    phoneNumber: { type: String, default: '' },
    google: { type: String, default: '' },
  },
  { _id: false }
);

// Main user schema
const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    occupation: String,
    role: { type: String, enum: ROLE_ENUM, default: 'user' },
    location: String,
    email: { type: String, unique: true, required: true },
    password: {
      type: String,
      required: true,
    },
    phoneNumber: String,
    profileImage: {
      type: String,
      default:
        'https://static.vecteezy.com/system/resources/previews/009/292/244/non_2x/default-avatar-icon-of-social-media-user-vector.jpg',
    },
    bannerImage: String,
    gender: String,
    dateOfBirth: Date,

    // References
    farm: { type: Schema.ObjectId, ref: 'Farm' },
    activities: [{ type: Schema.Types.ObjectId, ref: 'Activity' }],

    // Preferences and Settings with default values
    appPreferences: {
      type: appPreferencesSchema,
      default: (): Record<string, never> => ({}),
    },
    accountSettings: {
      securitySettings: {
        type: securitySettingsSchema,
        default: (): Record<string, never> => ({}),
      },
      notificationSettings: {
        type: notificationSettingsSchema,
        default: (): Record<string, never> => ({}),
      },
      privacySettings: {
        type: privacySettingsSchema,
        default: (): Record<string, never> => ({}),
      },
      connectedAccounts: {
        type: connectedAccountsSchema,
        default: (): Record<string, never> => ({}),
      },
    },

    cropSuggestionHistories: [{ type: Schema.Types.ObjectId, ref: 'CropSuggestionHistory' }],
  },
  { timestamps: true }
);

// Password hashing middleware
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

// Export model
export const User = models.User || model<IUser>('User', userSchema);
