import chai from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';

chai.use(sinonChai);

describe('GeoService', () => {
  beforeEach(() => {});

  afterEach(() => {
    sinon.restore();
  });

  it('constructs with default options', async () => {
    //   const service = new GeoService();
  });

  it('constructs with custom options.baseUrl', async () => {
    //   const service = new GeoService();
  });

  it('constructs with env BcgwBaseUrl', async () => {
    //   const service = new GeoService();
  });

  describe('_buildURL', async () => {
    it('builds and returns a url', async () => {
      //   const service = new GeoService();
    });
  });

  describe('_externalGet', async () => {
    it('makes a get request', async () => {
      //   const service = new GeoService();
    });
  });

  describe('_externalPost', async () => {
    it('makes a post request', async () => {
      //   const service = new GeoService();
    });
  });
});

describe('WebFeatureService', () => {
  beforeEach(() => {});

  afterEach(() => {
    sinon.restore();
  });

  describe('getCapabilities', async () => {
    it('makes a WFS getCapabilities get request', async () => {
      //   const service = new WebFeatureService();
    });
  });

  describe('getFeature', async () => {
    it('makes a WFS getFeature post request', async () => {
      //   const service = new WebFeatureService();
    });
  });
});

describe('WebMapService', () => {
  beforeEach(() => {});

  afterEach(() => {
    sinon.restore();
  });

  describe('getCapabilities', async () => {
    it('makes a WMS getCapabilities get request', async () => {
      //   const service = new WebMapService();
    });
  });

  describe('getMap', async () => {
    it('makes a WMS getMap get request', async () => {
      //   const service = new WebMapService();
    });
  });
});
