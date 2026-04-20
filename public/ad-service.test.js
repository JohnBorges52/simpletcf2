describe('AdService periodic popup timer', () => {
  const STORAGE_KEY = 'adService_lastPopupTime';
  const POPUP_INTERVAL_MS = 300000;

  function loadAdServiceClass() {
    jest.resetModules();
    document.body.innerHTML = '';

    window.SubscriptionService = {
      addTierChangeCallback: jest.fn(),
      currentUserData: {},
      _initPromise: null,
      waitForInit: jest.fn().mockResolvedValue(undefined),
      getCurrentTier: jest.fn().mockReturnValue('ad-free'),
      init: jest.fn(),
    };

    require('./ad-service.js');
    return window.AdService.constructor;
  }

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('sets baseline timestamp when no previous popup timestamp exists', () => {
    const AdServiceClass = loadAdServiceClass();
    const service = new AdServiceClass();
    const showSpy = jest.spyOn(service, '_showPeriodicPopup').mockImplementation(() => {});
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1700000000000);
    const getItemSpy = jest.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
    const setItemSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});

    service._maybeShowPeriodicPopup();

    expect(setItemSpy).toHaveBeenCalledWith(STORAGE_KEY, '1700000000000');
    expect(showSpy).not.toHaveBeenCalled();
    getItemSpy.mockRestore();
    setItemSpy.mockRestore();
    nowSpy.mockRestore();
  });

  test('shows popup and resets timestamp after 5 minutes have elapsed', () => {
    const AdServiceClass = loadAdServiceClass();
    const service = new AdServiceClass();
    const now = 1700000300000;
    const showSpy = jest.spyOn(service, '_showPeriodicPopup').mockImplementation(() => {});
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(now);
    const getItemSpy = jest
      .spyOn(Storage.prototype, 'getItem')
      .mockReturnValue(String(now - POPUP_INTERVAL_MS));
    const setItemSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});

    service._maybeShowPeriodicPopup();

    expect(setItemSpy).toHaveBeenCalledWith(STORAGE_KEY, String(now));
    expect(showSpy).toHaveBeenCalledTimes(1);
    getItemSpy.mockRestore();
    setItemSpy.mockRestore();
    nowSpy.mockRestore();
  });

  test('checks popup timer immediately and then every second', () => {
    const AdServiceClass = loadAdServiceClass();
    const service = new AdServiceClass();
    const checkSpy = jest.spyOn(service, '_maybeShowPeriodicPopup').mockImplementation(() => {});

    service._initPersistentPopupTimer();
    expect(checkSpy).toHaveBeenCalledTimes(1);

    checkSpy.mockClear();
    jest.advanceTimersByTime(3000);

    expect(checkSpy).toHaveBeenCalledTimes(3);

    clearInterval(service._popupCheckTimer);
    service._popupCheckTimer = null;
  });
});
