process.env.PORT = String(process.env.PORT || '3000').trim() || '3000';

if (!process.env.EXTRA_PORTS && !process.env.ADDITIONAL_PORTS) {
  process.env.EXTRA_PORTS = '5173,5174';
}

require('./server');
