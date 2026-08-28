const SimpleIndex = () => {
  return (
    <div style={{ 
      padding: '20px', 
      backgroundColor: '#1a1a1a', 
      color: 'white', 
      minHeight: '100vh',
      fontFamily: 'system-ui'
    }}>
      <h1>NoteForge - Simple Test</h1>
      <p>The app is working! Now gradually adding components...</p>
      <div style={{ marginTop: '20px', padding: '20px', backgroundColor: '#333', borderRadius: '8px' }}>
        <h2>Next Steps:</h2>
        <ul>
          <li>✅ React is rendering</li>
          <li>✅ Routing is working</li>
          <li>⏳ Adding editor components...</li>
        </ul>
      </div>
    </div>
  );
};

export default SimpleIndex;
