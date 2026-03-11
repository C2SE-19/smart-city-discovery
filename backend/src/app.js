const cors = require('cors');
const express = require('express');
const env = require('./config/env');
const errorHandler = require('./middlewares/error-handler');
const notFoundHandler = require('./middlewares/not-found-handler');
const apiRoutes = require('./routes');
const legacyRoutes = require('./routes/legacy.routes');

const app = express();
const corsOptions = env.corsOrigin === '*' ? {} : { origin: env.corsOrigin };

app.use(cors(corsOptions));
app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    service: env.appName,
    message: 'Smart City Discovery API scaffold is running.',
    docs: ['/api/v1/system/health', '/api/v1/system/modules', '/api/v1/wards', '/api/v1/venues']
  });
});

app.use('/api/v1', apiRoutes);
app.use('/api', legacyRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;