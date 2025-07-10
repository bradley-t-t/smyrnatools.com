/**
 * Serverless function to send emails via SendGrid
 * This file should be deployed as a serverless function
 * or integrated with your backend API
 */

// Load SendGrid package
// Note: For serverless functions, you'll need to ensure this package is installed
const sgMail = require('@sendgrid/mail');

/**
 * Handler for SendGrid emails requests
 * @param {Object} req Request object
 * @param {Object} res Response object
 */
exports.handler = async (req, res) => {
  try {
    // For serverless platforms like Vercel, Netlify, etc.
    // CORS headers
    if (res.setHeader) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }

    // Handle OPTIONS request (preflight)
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Get request data
    const { apiKey, payload } = req.body;

    if (!apiKey) {
      return res.status(400).json({ error: 'API key is required' });
    }

    if (!payload) {
      return res.status(400).json({ error: 'Email payload is required' });
    }

    // Set API key
    sgMail.setApiKey(apiKey);

    // Send emails
    const response = await sgMail.send(payload);

    // Return success response
    return res.status(200).json({
      success: true,
      message: 'Email sent successfully',
      response
    });
  } catch (error) {
    console.error('Error sending emails:', error);

    // Return error response
    return res.status(500).json({
      success: false,
      message: error.message,
      error: error.response ? error.response.body : undefined
    });
  }
};

/**
 * For Express.js implementation
 */
module.exports = (req, res) => {
  exports.handler(req, res);
};
