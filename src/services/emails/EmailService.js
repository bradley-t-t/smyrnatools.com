export async function sendEmailMock(emailData) {
    return new Promise((resolve) => {
        console.log('MOCK: Email would be sent with data:', emailData);
        if (emailData.subject && emailData.subject.includes('Recovery Code')) {
            const codeMatch = emailData.message.match(/code is: (\d+)/);
            if (codeMatch && codeMatch[1]) {
                const code = codeMatch[1];
                const email = emailData.to;
                localStorage.setItem(`recovery_code_${email}`, JSON.stringify({
                    code: code,
                    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString()
                }));
                console.log(`MOCK: Stored recovery code ${code} for ${email}`);
            }
        }
        setTimeout(() => {
            resolve({success: true, mockSent: true});
        }, 800);
    });
}
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