import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../../../store';
import { setActiveInstrument } from '../../../store/slices/uiSlice';
import { CryptoData } from '../types/dashboard';
import { formatPrice, formatVolume, formatChange } from './../utils/formatters';
import MiniSparklineChart from '../../../components/MiniSparklineChart';

interface CryptoTableProps {
  displayedCrypto: CryptoData[];
}

const CryptoTable: React.FC<CryptoTableProps> = ({ displayedCrypto }) => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const isLoggedIn = useAppSelector(state => !!state.auth.token);

  const handleBuyClick = (symbol: string) => {
    if (isLoggedIn) {
      dispatch(setActiveInstrument(symbol));
      navigate('/trading');
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="crypto-table">
      <div className="crypto-row crypto-header">
        <div className="crypto-col" style={{ textAlign: 'left' }}>Asset</div>
        <div className="crypto-col" style={{ textAlign: 'center' }}>Last Price</div>
        <div className="crypto-col" style={{ textAlign: 'center' }}>24h Change</div>
        <div className="crypto-col" style={{ textAlign: 'center' }}>Volume</div>
        <div className="crypto-col" style={{ textAlign: 'center' }}>Chart</div>
        <div className="crypto-col" style={{ textAlign: 'center' }}>Trade</div>
      </div>

      {displayedCrypto.map(crypto => (
        <div key={crypto.symbol} className="crypto-row">
          <div className="crypto-col" style={{ textAlign: 'left' }}>
            <div className="crypto-info">
              <div className="crypto-icon" style={{ background: crypto.gradient }}>{crypto.icon}</div>
              <div>
                <div className="crypto-symbol">{crypto.symbol.replace('USDT', '')}</div>
                <div className="crypto-name">{crypto.name}</div>
              </div>
            </div>
          </div>
          <div className="crypto-col crypto-price" style={{ textAlign: 'center' }}>
            ${formatPrice(crypto.price)}
          </div>
          <div className={`crypto-col crypto-change ${crypto.change > 0 ? 'positive' : 'negative'}`} style={{ textAlign: 'center' }}>
            <span className="change-arrow">{crypto.change > 0 ? '▲' : '▼'}</span> {formatChange(crypto.change)}
          </div>
          <div className="crypto-col" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
            {formatVolume(crypto.volume24h)}
          </div>
          <div className="crypto-col" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <MiniSparklineChart
              symbol={crypto.symbol}
              color={crypto.change > 0 ? '#10b981' : '#ef4444'}
              width={120}
              height={40}
            />
          </div>
          <div className="crypto-col" style={{ textAlign: 'center' }}>
            <button className="btn-trade" onClick={() => handleBuyClick(crypto.symbol)}>Buy</button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default CryptoTable;