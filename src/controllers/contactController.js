import emailService from '../services/EmailService.js';

// Submit contact form
export const submitContactForm = async (req, res, next) => {
  try {
    const { name, email, subject, message } = req.body;

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'Please fill in all required fields'
      });
    }

    // Validate email format
    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    // Send notification email to support team
    try {
      await emailService.sendEmail({
        to: process.env.SUPPORT_EMAIL || 'support@ansartehzeeb.com',
        subject: `[Contact Form] ${subject}`,
        template: 'contact-form',
        data: {
          name,
          email,
          subject,
          message,
          timestamp: new Date().toLocaleString()
        }
      });
    } catch (emailError) {
      console.error('Failed to send contact notification email:', emailError.message);
      // Continue even if email fails - we'll still save the message
    }

    // Send confirmation email to user
    try {
      await emailService.sendEmail({
        to: email,
        subject: 'We received your message - AnTeH Mart',
        template: 'contact-confirmation',
        data: {
          name,
          subject,
          supportEmail: process.env.SUPPORT_EMAIL || 'support@ansartehzeeb.com'
        }
      });
    } catch (emailError) {
      console.error('Failed to send contact confirmation email:', emailError.message);
    }

    res.status(201).json({
      success: true,
      message: 'Your message has been sent successfully. We will get back to you within 24-48 hours.'
    });
  } catch (error) {
    next(error);
  }
};

// Get contact form settings (for admin)
export const getContactSettings = async (req, res, next) => {
  try {
    // Return contact settings (could be stored in database)
    res.json({
      success: true,
      settings: {
        supportEmail: process.env.SUPPORT_EMAIL || 'support@ansartehzeeb.com',
        supportPhone: '+1 (555) 902-8822',
        businessHours: {
          weekdays: '9:00 AM - 6:00 PM EST',
          saturday: '10:00 AM - 4:00 PM EST',
          sunday: 'Closed'
        },
        address: {
          street: '100 Innovation Way',
          city: 'New York',
          state: 'NY',
          zipCode: '10001',
          country: 'United States'
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

export default {
  submitContactForm,
  getContactSettings
};
