import '../index.css'
const Header = () => {
  return (
    // Outer wrapper to position the header at the top
    <header className="w-full flex justify-center pt-6 px-4 absolute top-0 z-50">
      {/* Glassmorphism Container */}
      <div className="flex items-center justify-between w-full max-w-7xl px-8 py-3 bg-white/50 backdrop-blur-md border border-white/40 rounded-full shadow-sm">
        
        {/* Logo Section */}
        <div className="flex items-center">
          <span className="text-2xl font-bold tracking-tight text-black">
            CIVIC LOOP
          </span>
        </div>

        {/* Navigation Links (Hidden on mobile, visible on medium+ screens) */}
        <nav className="hidden md:flex items-center space-x-8">
          {['Platform', 'Developers', 'Resources', 'Company'].map((item) => (
            <a 
              key={item} 
              href={`#${item.toLowerCase()}`} 
              className="text-[11px] font-bold tracking-widest uppercase text-gray-900 hover:text-gray-600 transition-colors"
            >
              {item}
            </a>
          ))}
        </nav>

        {/* Call to Action Buttons */}
        <div className="flex items-center space-x-3">
          {/* Dark Button with slight outer glow/shadow */}
          <button className="px-5 py-2.5 bg-[#1a1a1a] text-white text-sm font-medium rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.4)] hover:bg-black transition-all">
            Experience Sarvam
          </button>
          
          {/* Light Glassy Button */}
          <button className="px-5 py-2.5 bg-white/70 backdrop-blur-sm text-gray-900 text-sm font-medium rounded-full hover:bg-white transition-all">
            Talk to Sales
          </button>
        </div>

      </div>
    </header>
  );
};

export default Header;