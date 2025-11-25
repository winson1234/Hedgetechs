export const validateEmail = (email: string): string | null => {
    const trimmed = email.trim();
    
    if (!trimmed) {
      return 'Please enter your email address';
    }
    
    if (!trimmed.includes('@') || !trimmed.includes('.')) {
      return 'Please enter a valid email address';
    }
    
    return null;
  };