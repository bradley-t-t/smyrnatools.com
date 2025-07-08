# Email Utilities Documentation

## Overview

This document provides information about the email utilities implemented in this project using SendGrid.

## Setup

1. Make sure you have the SendGrid package installed:
   ```
   npm install @sendgrid/mail
   ```

2. Ensure your SendGrid API key is set in your environment variables:
   ```
   REACT_APP_SENDGRID_API_KEY=your_api_key_here
   ```

3. Copy the `.env.example` file to `.env.local` and fill in your actual API key.

4. **Important**: Make sure your sender email domain is verified in your SendGrid account.

## Testing Email Functionality

A test component is available to verify email sending functionality:

```jsx
import TestEmailSender from './components/test/TestEmailSender';

// Then use it in your component tree
<TestEmailSender />
```

This component provides a form to send test emails and displays any errors that occur during the process.

## Available Components

### EmailUtil

A utility class that provides core email functionality using the SendGrid API.

```javascript
import EmailUtil from './utils/EmailUtil';

// Initialize the library
EmailUtil.initialize();

// Send a basic email
await EmailUtil.sendEmail({
  to: 'recipient@example.com',
  from: 'sender@yourdomain.com',
  subject: 'Hello from our app',
  text: 'This is a plain text email',
  html: '<p>This is an HTML email</p>'
});

// Send a templated email
await EmailUtil.sendTemplateEmail({
  to: 'recipient@example.com',
  from: 'sender@yourdomain.com',
  templateId: 'd-your-sendgrid-template-id',
  dynamicTemplateData: {
    name: 'John Doe',
    confirmationLink: 'https://example.com/confirm'
  }
});

// Send a notification with optional action button
await EmailUtil.sendNotification({
  to: 'recipient@example.com',
  from: 'sender@yourdomain.com',
  subject: 'Action Required',
  message: 'Please complete your profile',
  actionUrl: 'https://example.com/profile',
  actionText: 'Complete Profile'
});

// Validate an email
const isValid = EmailUtil.validateEmail('test@example.com');
```

### EmailService

A service that provides higher-level email functionality for specific use cases.

```javascript
import emailService from './services/EmailService';

// Send a welcome email
await emailService.sendWelcomeEmail('user@example.com', 'John Doe');

// Send a password reset email
await emailService.sendPasswordResetEmail('user@example.com', 'https://example.com/reset?token=abc123');

// Send a custom notification
await emailService.sendCustomNotification(
  'user@example.com',
  'Important Update',
  'Your account has been updated',
  'https://example.com/account',
  'View Account'
);

// Change the default sender email
emailService.setDefaultSender('newemail@yourdomain.com');
```

### EmailVerificationService

A service for handling email verification workflows.

```javascript
import emailVerificationService from './services/auth/EmailVerificationService';

// Send a verification email
await emailVerificationService.sendVerificationEmail('user@example.com', 'user-id-123');

// Verify an email using a token
const result = await emailVerificationService.verifyEmail('verification-token-123');
if (result.success) {
  console.log('Email verified successfully');
}
```

## Best Practices

1. **Always validate email addresses** before sending emails to avoid delivery issues.

2. **Use templates for consistent branding** across all emails sent from your application.

3. **Provide both HTML and plain text versions** of your emails for maximum compatibility.

4. **Keep sensitive information out of emails** and use secure links instead.

5. **Monitor delivery rates and bounces** through the SendGrid dashboard.

6. **Test emails in different clients** before sending to your users.

## SendGrid Resources

- [SendGrid Documentation](https://docs.sendgrid.com/)
- [SendGrid Node.js SDK](https://github.com/sendgrid/sendgrid-nodejs)
- [SendGrid Templates](https://mc.sendgrid.com/dynamic-templates)
