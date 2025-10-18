import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { hasPermission, PERMISSIONS } from '../../utils/permissions';
import apiRequest from '../../utils/api';
import Editor from '@monaco-editor/react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faArrowLeft, 
  faFolder, 
  faFile, 
  faSave, 
  faDownload,
  faTrashAlt,
  faFilePdf
} from '@fortawesome/free-solid-svg-icons';
import './FileEditor.css';

const FileEditor = () => {
  const { user } = useAuth();
  const { deviceId } = useParams();
  const navigate = useNavigate();
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [currentPath, setCurrentPath] = useState('/');
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [editorLanguage, setEditorLanguage] = useState('plaintext');
  const [notification, setNotification] = useState(null);

  // Helper function to show notifications
  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000); // Auto-hide after 5 seconds
  };

  useEffect(() => {
    fetchDeviceInfo();
  }, [deviceId]);

  useEffect(() => {
    if (deviceInfo) {
      fetchFiles(currentPath);
    }
  }, [deviceInfo, currentPath]);

  const fetchDeviceInfo = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await apiRequest(`/api/devices/${deviceId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setDeviceInfo(data);
      }
    } catch (error) {
      console.error('Error fetching device info:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFiles = async (path) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await apiRequest(`/api/files/${deviceId}?path=${encodeURIComponent(path)}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setFiles(data.files || []);
      } else {
        console.error('Failed to fetch files:', response.status);
      }
    } catch (error) {
      console.error('Error fetching files:', error);
    }
  };

  const handleFileClick = async (file) => {
    if (file.type === 'directory') {
      setCurrentPath(file.path);
      setSelectedFile(null);
      setFileContent('');
    } else if (isPdfFile(file.name)) {
      // Handle PDF files - open in new tab
      setLoading(true);
      showNotification('Loading PDF... This may take a moment for large files.', 'success');
      
      try {
        const token = localStorage.getItem('authToken');
        
        // Set a timeout for very large files
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60000); // 60 second timeout
        
        const response = await apiRequest(`/api/files/${deviceId}/read?path=${encodeURIComponent(file.path)}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          },
          signal: controller.signal
        });
        
        clearTimeout(timeout);

        if (response.ok) {
          const data = await response.json();
          
          // Create a blob URL for the PDF and open in new tab
          const pdfBlob = new Blob([Uint8Array.from(atob(data.content), c => c.charCodeAt(0))], { type: 'application/pdf' });
          const pdfUrl = URL.createObjectURL(pdfBlob);
          
          // Open PDF in new tab
          const newWindow = window.open(pdfUrl, '_blank');
          
          // If popup was blocked, show notification
          if (!newWindow) {
            showNotification('Popup blocked. Please allow popups for this site to view PDFs.', 'error');
            URL.revokeObjectURL(pdfUrl);
            setLoading(false);
            return;
          }
          
          // Clean up the URL after a delay to free memory
          setTimeout(() => URL.revokeObjectURL(pdfUrl), 1000);
          
          // Show success notification
          showNotification('PDF opened in new tab', 'success');
        } else if (response.status === 413) {
          showNotification('PDF file is too large (max 50MB)', 'error');
        } else {
          console.error('Failed to read PDF file:', response.status);
          showNotification('Failed to open PDF file', 'error');
        }
      } catch (error) {
        if (error.name === 'AbortError') {
          showNotification('PDF loading timed out. The file may be too large.', 'error');
        } else {
          console.error('Error reading PDF file:', error);
          showNotification('Error opening PDF file', 'error');
        }
      } finally {
        setLoading(false);
      }
    } else {
      // Handle regular files (text, images, etc.)
      try {
        const token = localStorage.getItem('authToken');
        const response = await apiRequest(`/api/files/${deviceId}/read?path=${encodeURIComponent(file.path)}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          setSelectedFile(file);
          setFileContent(data.content || '');
          const detectedLanguage = getLanguageFromExtension(file.name);
          setEditorLanguage(detectedLanguage);
          console.log('File loaded:', file.name, 'Language:', detectedLanguage, 'Content length:', data.content?.length);
        } else {
          console.error('Failed to read file:', response.status);
        }
      } catch (error) {
        console.error('Error reading file:', error);
      }
    }
  };

  const getLanguageFromExtension = (filename) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    const languageMap = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'py': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'html': 'html',
      'css': 'css',
      'json': 'json',
      'xml': 'xml',
      'md': 'markdown',
      'txt': 'plaintext',
      'sh': 'shell',
      'bash': 'shell',
      'php': 'php',
      'rb': 'ruby',
      'go': 'go',
      'rs': 'rust'
    };
    return languageMap[ext] || 'plaintext';
  };

  const isImageFile = (filename) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico'];
    return imageExtensions.includes(ext);
  };

  const isPdfFile = (filename) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    return ext === 'pdf';
  };

  const handleSave = async () => {
    if (!selectedFile) return;

    try {
      const token = localStorage.getItem('authToken');
      const response = await apiRequest(`/api/files/${deviceId}/write`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          path: selectedFile.path,
          content: fileContent
        })
      });

      if (response.ok) {
        console.log('File saved successfully');
        // Show success feedback
        showNotification('File saved successfully!', 'success');
        // Refresh the file content to ensure it's up to date
        handleFileClick(selectedFile);
      } else {
        const error = await response.json();
        console.error('Failed to save file:', error);
        showNotification(`Failed to save file: ${error.error}`, 'error');
      }
    } catch (error) {
      console.error('Error saving file:', error);
      showNotification('Network error while saving file', 'error');
    }
  };

  const handleDownload = () => {
    if (!selectedFile) return;

    try {
      let blob;
      
      if (isImageFile(selectedFile.name)) {
        // For images, convert base64 to binary
        const binaryString = atob(fileContent);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        blob = new Blob([bytes], { type: `image/${selectedFile.name.split('.').pop()}` });
      } else {
        // For text files, use content as-is
        blob = new Blob([fileContent], { type: 'text/plain' });
      }
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = selectedFile.name;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      showNotification('Failed to download file', 'error');
    }
  };

  const handleDelete = async () => {
    if (!selectedFile) return;
    
    if (!window.confirm(`Are you sure you want to delete "${selectedFile.name}"?`)) {
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      const response = await apiRequest(`/api/files/${deviceId}/delete`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          path: selectedFile.path
        })
      });

      if (response.ok) {
        console.log('File deleted successfully');
        // Refresh file list and clear selection
        setSelectedFile(null);
        setFileContent('');
        fetchFiles(currentPath);
        showNotification('File deleted successfully!', 'success');
      } else {
        const error = await response.json();
        console.error('Failed to delete file:', error);
        showNotification(`Failed to delete file: ${error.error}`, 'error');
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      showNotification('Network error while deleting file', 'error');
    }
  };

  const navigateUp = () => {
    const pathParts = currentPath.split('/').filter(Boolean);
    if (pathParts.length > 0) {
      pathParts.pop();
      setCurrentPath('/' + pathParts.join('/'));
    }
  };

  // Permission checks
  if (!hasPermission(user, PERMISSIONS.ACCESS_TERMINAL)) {
    return (
      <div className="file-editor-container">
        <div className="access-denied">
          <h2>Access Denied</h2>
          <p>You don't have permission to access the file editor.</p>
          <button onClick={() => navigate('/devices')}>Go Back</button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="file-editor-container">
        <div className="loading">Loading file editor...</div>
      </div>
    );
  }

  return (
    <div className="file-editor-container">
      <div className="file-editor-header">
        <div className="header-left">
          <button className="back-btn" onClick={() => navigate('/devices')}>
            <FontAwesomeIcon icon={faArrowLeft} size="sm" />
            Back
          </button>
          <div className="device-info">
            <h2>{deviceInfo?.name}</h2>
            <p>{deviceInfo?.ip}</p>
          </div>
        </div>
      </div>

      <div className="file-editor-content">
        <div className="file-explorer">
          <div className="explorer-header">
            <h3>Files</h3>
            <div className="path-navigation">
              <button 
                className="nav-btn"
                onClick={navigateUp}
                disabled={currentPath === '/'}
              >
                ..
              </button>
              <span className="current-path">{currentPath}</span>
            </div>
          </div>
          <div className="file-list">
            {files.map((file) => (
              <div
                key={file.path}
                className={`file-item ${selectedFile?.path === file.path ? 'selected' : ''}`}
                onClick={() => handleFileClick(file)}
                title={isPdfFile(file.name) ? 'Click to open PDF in new tab' : file.type === 'directory' ? 'Click to open folder' : 'Click to open file'}
              >
                {file.type === 'directory' ? (
                  <FontAwesomeIcon icon={faFolder} size="sm" />
                ) : isPdfFile(file.name) ? (
                  <FontAwesomeIcon icon={faFilePdf} size="sm" />
                ) : (
                  <FontAwesomeIcon icon={faFile} size="sm" />
                )}
                <span className="file-name">{file.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="file-editor">
          {selectedFile ? (
            <>
              <div className="editor-header">
                <h3>{selectedFile.name}</h3>
                <div className="editor-actions">
                  {!isImageFile(selectedFile.name) && (
                    <button className="action-btn" onClick={handleSave}>
                      <FontAwesomeIcon icon={faSave} />
                    </button>
                  )}
                  <button className="action-btn" onClick={handleDownload}>
                    <FontAwesomeIcon icon={faDownload} />
                  </button>
                  <button className="action-btn delete" onClick={handleDelete}>
                    <FontAwesomeIcon icon={faTrashAlt} />
                  </button>
                </div>
              </div>
              <div className="editor-content">
                {isImageFile(selectedFile.name) ? (
                  <div className="image-viewer">
                    <img 
                      src={`data:image/${selectedFile.name.split('.').pop()};base64,${fileContent}`}
                      alt={selectedFile.name}
                      style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                    />
                  </div>
                ) : (
                  <Editor
                    key={`${selectedFile.path}-${editorLanguage}`}
                    height="100%"
                    language={editorLanguage}
                    value={fileContent}
                    onChange={setFileContent}
                    theme="vs-dark"
                    options={{
                      automaticLayout: true,
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      fontSize: 14,
                      lineNumbers: 'on',
                      wordWrap: 'on'
                    }}
                    onMount={(editor, monaco) => {
                      // Ensure proper initialization and theme
                      editor.layout();
                      monaco.editor.setTheme('vs-dark');
                    }}
                  />
                )}
              </div>
            </>
          ) : (
            <div className="no-file-selected">
              <FontAwesomeIcon icon={faFile} size="3x" />
              <h3>No file selected</h3>
              <p>Select a file from the explorer to start editing</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Notification */}
      {notification && (
        <div className={`notification notification-${notification.type}`}>
          {notification.message}
        </div>
      )}
    </div>
  );
};

export default FileEditor; 