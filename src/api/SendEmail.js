const sgMail = require('@sendgrid/mail');
exports.handler = async (req, res) => {
    try {
        if (res.setHeader) {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        }
        if (req.method === 'OPTIONS') {
            return res.status(200).end();
        }
        if (req.method !== 'POST') {
            return res.status(405).json({error: 'Method not allowed'});
        }
        const {apiKey, payload} = req.body;
        if (!apiKey) {
            return res.status(400).json({error: 'API key is required'});
        }
        if (!payload) {
            return res.status(400).json({error: 'Email payload is required'});
        }
        sgMail.setApiKey(apiKey);
        const response = await sgMail.send(payload);
        return res.status(200).json({
            success: true,
            message: 'Email sent successfully',
            response
        });
    } catch (error) {
        console.error('Error sending email:', error);
        return res.status(500).json({
            success: false,
            message: error.message,
            error: error.response ? error.response.body : undefined
        });
    }
};
module.exports = (req, res) => {
    exports.handler(req, res);
};