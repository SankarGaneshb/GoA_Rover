const FSWorkspace = require('../../extension/lib/fs-workspace');

describe('Layer 5: FSWorkspace (File System Access Bridge)', () => {
  let ws;
  let mockFileStore = {};

  function createMockDirHandle(name = 'mock-project') {
    return {
      name,
      getDirectoryHandle: jest.fn().mockImplementation((dirName) => {
        return Promise.resolve(createMockDirHandle(dirName));
      }),
      getFileHandle: jest.fn().mockImplementation((fileName, opts) => {
        return Promise.resolve({
          name: fileName,
          getFile: () => Promise.resolve({
            text: () => Promise.resolve(mockFileStore[fileName] || 'console.log("hello");')
          }),
          createWritable: () => {
            let buffer = '';
            return Promise.resolve({
              write: (data) => {
                buffer += data;
                mockFileStore[fileName] = buffer;
                return Promise.resolve();
              },
              close: () => Promise.resolve()
            });
          }
        });
      })
    };
  }

  beforeEach(() => {
    ws = new FSWorkspace();
    mockFileStore = {};
  });

  test('reports disconnected initially', () => {
    expect(ws.isConnected()).toBe(false);
  });

  test('connects via picker and retains directory handle', async () => {
    const mockPicker = jest.fn().mockResolvedValue(createMockDirHandle('my-web-app'));
    const res = await ws.connect(mockPicker);

    expect(res.success).toBe(true);
    expect(res.dirName).toBe('my-web-app');
    expect(ws.isConnected()).toBe(true);
  });

  test('handles connect error or cancellation gracefully', async () => {
    const mockPicker = jest.fn().mockRejectedValue(new Error('User cancelled'));
    const res = await ws.connect(mockPicker);

    expect(res.success).toBe(false);
    expect(res.error).toBe('User cancelled');
    expect(ws.isConnected()).toBe(false);
  });

  test('handles missing picker API gracefully', async () => {
    const res = await ws.connect(null);
    expect(res.success).toBe(false);
    expect(res.error).toContain('not supported');
  });

  test('reads file when connected', async () => {
    mockFileStore['UserCard.jsx'] = 'export const UserCard = () => <div/>;';
    await ws.connect(jest.fn().mockResolvedValue(createMockDirHandle()));

    const res = await ws.readFile('src/components/UserCard.jsx');
    expect(res.success).toBe(true);
    expect(res.content).toBe('export const UserCard = () => <div/>;');
  });

  test('writes file content when connected', async () => {
    await ws.connect(jest.fn().mockResolvedValue(createMockDirHandle()));

    const writeRes = await ws.writeFile('src/components/App.tsx', 'const x = 1;');
    expect(writeRes.success).toBe(true);

    const readRes = await ws.readFile('src/components/App.tsx');
    expect(readRes.content).toBe('const x = 1;');
  });

  test('returns error when reading/writing while disconnected', async () => {
    const readRes = await ws.readFile('test.js');
    expect(readRes.success).toBe(false);
    expect(readRes.error).toContain('No workspace directory connected');

    const writeRes = await ws.writeFile('test.js', 'content');
    expect(writeRes.success).toBe(false);
    expect(writeRes.error).toContain('No workspace directory connected');
  });

  test('handles invalid file paths gracefully', async () => {
    await ws.connect(jest.fn().mockResolvedValue(createMockDirHandle()));
    expect((await ws.readFile(null)).success).toBe(false);
    expect((await ws.writeFile(null, '')).success).toBe(false);
  });

  test('disconnect clears handle', async () => {
    await ws.connect(jest.fn().mockResolvedValue(createMockDirHandle()));
    expect(ws.isConnected()).toBe(true);
    ws.disconnect();
    expect(ws.isConnected()).toBe(false);
  });
});
