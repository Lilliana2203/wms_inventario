const bcrypt = require('bcryptjs');

const hash = '$2b$10$O8r4GCfn.2sL48t5Yc/zSOb5oujwTuMT8K4hwS5D5bQ7BvKszmn4C';
bcrypt.compare('Password11*', hash).then(res => {
  console.log('Result for Password11*:', res);
});
bcrypt.compare('pruebac123', hash).then(res => {
  console.log('Result for pruebac123:', res);
});
bcrypt.compare('pruebac', hash).then(res => {
  console.log('Result for pruebac:', res);
});
bcrypt.compare('password', hash).then(res => {
  console.log('Result for password:', res);
});
