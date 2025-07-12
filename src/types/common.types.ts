export interface SuccessResponse<T> {
  success: boolean;
  message: string;
  data?: T;
}

export interface Location {
  latitude: number;
  longitude: number;
}

export interface LocationWithAddress extends Location {
  country: string;
  state: string;
  city: string;
  zipCode?: string;
}
