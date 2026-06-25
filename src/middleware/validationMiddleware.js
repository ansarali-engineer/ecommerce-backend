export const validateBody = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
    
    if (error) {
      const errorMessages = error.details.map(d => d.message).join(', ');
      return res.status(400).json({
        success: false,
        message: `Validation Error: ${errorMessages}`
      });
    }
    
    req.body = value; // replace req.body with cleaned/validated values
    next();
  };
};

export const validateQuery = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, { abortEarly: false, stripUnknown: true });
    
    if (error) {
      const errorMessages = error.details.map(d => d.message).join(', ');
      return res.status(400).json({
        success: false,
        message: `Query Validation Error: ${errorMessages}`
      });
    }
    
    req.query = value;
    next();
  };
};
