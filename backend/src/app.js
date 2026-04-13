const cors = require('cors');
const express = require('express');
const env = require('./config/env');
const errorHandler = require('./middlewares/error-handler');
const notFoundHandler = require('./middlewares/not-found-handler');
const apiRoutes = require('./routes');
const legacyRoutes = require('./routes/legacy.routes');
const app = express();
const corsOptions = env.corsOrigin === '*' ? {} : { origin: env.corsOrigin };
const chatRoute = require("./routes/chat.route");

app.use(cors(corsOptions));
app.use(express.json({ limit: '20mb' }));

// Chat route - BEFORE /api routes to have priority
app.use("/api/chat", chatRoute);

app.get('/', (req, res) => {
  res.json({
    service: env.appName,
    message: 'Smart City Discovery API scaffold is running.',
    docs: ['/api/v1/system/health', '/api/v1/system/modules', '/api/v1/wards', '/api/v1/venues']
  });
});

app.use('/api/v1', apiRoutes);
app.use('/api', apiRoutes);  // Also support /api for backward compatibility
app.use('/legacy', legacyRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
