import path from 'path';
import fs from 'fs';

const testdataPath = path.resolve(__dirname, 'testdata');

jest.spyOn(global, 'fetch').mockImplementation(
  jest.fn((url: string) => {
    const { pathname } = new URL(url);
    const dataFile = path.join(testdataPath, `${pathname}.json`);
    if (!fs.existsSync(dataFile)) return Promise.reject(`${url} not found`);
    const data = JSON.parse(fs.readFileSync(dataFile).toString());
    return Promise.resolve({ json: () => Promise.resolve(data) });
  }) as jest.Mock
);
