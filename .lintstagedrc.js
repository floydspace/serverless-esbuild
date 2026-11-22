module.exports = {
  '*.ts': ['prettier --write', 'eslint', () => 'pnpm typecheck'],
};
