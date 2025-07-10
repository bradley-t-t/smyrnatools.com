/**
 * Client-side mock email service
 * In a production environment, this would be replaced with API calls to a backend service
 */

/**
 * Mock function to simulate sending email
 * This is a temporary solution until a proper backend is implemented
 * @param {Object} emailData Email data to send
 * @returns {Promise<Object>} Mock response
 */
export async function sendEmailMock(emailData) {
  return new Promise((resolve) => {
    console.log('MOCK: Email would be sent with data:', emailData);

    // Store the verification code in localStorage for testing
    if (emailData.subject && emailData.subject.includes('Recovery Code')) {
      const codeMatch = emailData.message.match(/code is: (\d+)/);
      if (codeMatch && codeMatch[1]) {
        const code = codeMatch[1];
        const email = emailData.to;

        // Store the code for verification later
        localStorage.setItem(`recovery_code_${email}`, JSON.stringify({
          code: code,
          expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString()
        }));

        console.log(`MOCK: Stored recovery code ${code} for ${email}`);
      }
    }

    // Simulate network delay
    setTimeout(() => {
      resolve({ success: true, mockSent: true });
    }, 800);
  });
}

/**
 * Get a mock recovery code for testing
 * @param {string} email The email address
 * @returns {string|null} The recovery code or null if not found
 */
export function getMockRecoveryCode(email) {
  const storedData = localStorage.getItem(`recovery_code_${email}`);
  if (storedData) {
    try {
      const data = JSON.parse(storedData);
      return data.code;
    } catch (error) {
      console.error('Error parsing mock recovery code:', error);
    }
  }
  return null;
}
