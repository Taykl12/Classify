export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  dni: string;
  profilePhotoUrl: string | null;
  roleLabel?: string;
}

export interface ProfileFormState {
  firstName: string;
  lastName: string;
  dni: string;
  email: string;
  newPassword: string;
  confirmPassword: string;
}

export function profileToForm(profile: UserProfile): ProfileFormState {
  return {
    firstName: profile.firstName,
    lastName: profile.lastName,
    dni: profile.dni,
    email: profile.email,
    newPassword: "",
    confirmPassword: "",
  };
}
