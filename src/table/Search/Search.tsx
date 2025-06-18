import React from 'react';
import { Input } from 'antd';

const { Search: AntSearch } = Input;

interface ISearchProps {
  onSearch: (value: string) => void;
}

export const Search: React.FC<ISearchProps> = ({ onSearch }) => {
  return (
    <div style={{ marginBottom: 16 }}>
      <AntSearch
        placeholder="Search..."
        onSearch={onSearch}
        enterButton
        size="large"
      />
    </div>
  );
}; 