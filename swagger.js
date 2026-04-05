const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Hari Club Hotel API',
      version: '1.0.0',
      description: 'Documentation de l\'API pour le système de gestion de l\'hôtel Hari Club',
    },
    servers: [
      {
        url: 'http://localhost:3001',
        description: 'Serveur de développement',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: ['./index.js'], // Scanne les fichiers pour les annotations JSDoc
};

const specs = swaggerJsdoc(options);
module.exports = specs;
