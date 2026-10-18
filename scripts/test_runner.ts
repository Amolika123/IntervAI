import { spawnSync } from 'child_process';

async function runSystemIntegrityTests() {
  console.log('==================================================');
  console.log('RUNNING INTERVAI END-TO-END INTEGRITY TEST SUITE');
  console.log('Backend: Python + FastAPI + SQLAlchemy + OpenAI SDK');
  console.log('==================================================\n');

  console.log('Executing Python backend test suite (backend/tests)...');
  const result = spawnSync('python -m pytest backend/tests -v', {
    stdio: 'inherit',
    shell: true,
  });

  if (result.status !== 0) {
    console.error('\n[FAIL] Python test suite exited with error code:', result.status);
    process.exit(result.status || 1);
  }

  console.log('\n==================================================');
  console.log('TEST SUMMARY: All backend tests passed successfully!');
  console.log('==================================================');
}

runSystemIntegrityTests();
