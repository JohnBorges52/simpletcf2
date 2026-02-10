// Configuração para testes frontend
// Simula o ambiente do navegador

// Mock do Firebase (será sobrescrito em testes específicos)
global.firebase = {
  auth: jest.fn(),
  firestore: jest.fn(),
  initializeApp: jest.fn(),
};

// Mock do Stripe
global.Stripe = jest.fn(() => ({
  redirectToCheckout: jest.fn(),
}));

// Mock do localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock do window.location
delete window.location;
window.location = {
  href: '',
  pathname: '/',
  search: '',
  hash: '',
  reload: jest.fn(),
};

// Limpa todos os mocks antes de cada teste
beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
});
