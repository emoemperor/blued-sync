export default () => ({
  port: parseInt(process.env.PORT, 10) || 3999,
  database: {
    host: process.env.DB_HOST || 'mongodb://localhost:27017',
    dbName: 'blued-sync',
  },
  bark: {
    key: process.env.BARK_KEY || '',
  },
  system_setting_key: {
    blued_auth: 'blued-auth',
  },
});
