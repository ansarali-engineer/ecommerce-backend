import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'eCommerce REST API',
      version: '1.0.0',
      description: 'API documentation for the eCommerce React + Node.js application',
      contact: {
        name: 'Developer Support'
      }
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: ['./src/routes/*.js'] // Document endpoints by reading routes
};

const swaggerSpec = swaggerJsdoc(options);
export default swaggerSpec;
