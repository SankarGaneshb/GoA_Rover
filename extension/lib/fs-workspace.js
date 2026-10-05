/**
 * GoA_Rover - Layer 5: Workspace File System Access Bridge
 * Uses the Web File System Access API (showDirectoryPicker) to directly
 * read, modify, and patch local source files in-situ without leaving the browser.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.FSWorkspace = factory();
    if (typeof window !== 'undefined' && !window.__GOA_ROVER_FS__) {
      window.__GOA_ROVER_FS__ = new root.FSWorkspace();
    }
  }
})(typeof self !== 'undefined' ? self : this, function () {

  class FSWorkspace {
    constructor() {
      this.dirHandle = null;
    }

    isConnected() {
      return this.dirHandle !== null;
    }

    /**
     * Prompts developer to select their project root folder once
     */
    async connect(customPicker = null) {
      try {
        const picker = customPicker || (typeof window !== 'undefined' && window.showDirectoryPicker);
        if (typeof picker !== 'function') {
          return {
            success: false,
            error: 'File System Access API not supported in this environment'
          };
        }
        this.dirHandle = await picker({ mode: 'readwrite' });
        return {
          success: true,
          dirName: this.dirHandle ? this.dirHandle.name : 'workspace'
        };
      } catch (err) {
        return {
          success: false,
          error: err ? err.message : 'User cancelled or directory selection failed'
        };
      }
    }

    disconnect() {
      this.dirHandle = null;
    }

    /**
     * Reads a file at relative path (e.g., 'src/components/UserCard.jsx')
     */
    async readFile(relativePath) {
      if (!this.dirHandle) {
        return { success: false, error: 'No workspace directory connected' };
      }
      if (!relativePath || typeof relativePath !== 'string') {
        return { success: false, error: 'Invalid file path' };
      }

      try {
        const fileHandle = await this.resolveFileHandle(relativePath, false);
        const file = await fileHandle.getFile();
        const content = await file.text();
        return { success: true, content };
      } catch (err) {
        return {
          success: false,
          error: err ? err.message : 'File read error'
        };
      }
    }

    /**
     * Writes/patches content to a file at relative path
     */
    async writeFile(relativePath, content) {
      if (!this.dirHandle) {
        return { success: false, error: 'No workspace directory connected' };
      }
      if (!relativePath || typeof relativePath !== 'string') {
        return { success: false, error: 'Invalid file path' };
      }

      try {
        const fileHandle = await this.resolveFileHandle(relativePath, true);
        const writable = await fileHandle.createWritable();
        await writable.write(content);
        await writable.close();
        return { success: true, path: relativePath };
      } catch (err) {
        return {
          success: false,
          error: err ? err.message : 'File write error'
        };
      }
    }

    /**
     * Traverses directories to locate or create the requested file handle
     */
    async resolveFileHandle(relativePath, create = false) {
      const parts = relativePath.replace(/\\/g, '/').split('/').filter(Boolean);
      const fileName = parts.pop();
      let currentDir = this.dirHandle;

      for (const segment of parts) {
        currentDir = await currentDir.getDirectoryHandle(segment, { create });
      }

      return await currentDir.getFileHandle(fileName, { create });
    }
  }

  return FSWorkspace;
});
