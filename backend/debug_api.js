const axios = require('axios');

(async () => {
  try {
    const loginRes = await axios.post('http://localhost:5000/api/login', {
      username: 'admin',
      password: 'Admin@123!'
    });

    console.log('login', loginRes.data);

    const token = loginRes.data.token;

    const usersRes = await axios.get('http://localhost:5000/api/admin/users', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    console.log('users', usersRes.data);
  } catch (err) {
    if (err.response) {
      console.error('HTTP', err.response.status, err.response.data);
    } else {
      console.error('ERR', err.message);
    }
  }
})();