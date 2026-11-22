module.exports = {
  '*.ts': ['prettier --write', 'eslint', () => 'tsc --noEmit'],
};
