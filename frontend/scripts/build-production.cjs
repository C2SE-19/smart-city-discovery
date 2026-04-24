const { execSync } = require('child_process');

const frontendRoot = require('path').resolve(__dirname, '..');

const env = {
	...process.env,
	VITE_API_BASE_URL: process.env.VITE_API_BASE_URL || 'http://10.50.1.240:3000/api'
};

try {
	execSync('npm run build:raw', {
		cwd: frontendRoot,
		env,
		stdio: 'inherit',
		shell: true
	});
} catch (error) {
	process.exit(error && typeof error.status === 'number' ? error.status : 1);
}
