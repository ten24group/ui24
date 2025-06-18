import React from 'react';
import { Input } from 'antd';

const { Search: AntSearch } = Input;

interface ISearchProps {
  onSearch: (value: string) => void;
}

export const Search: React.FC<ISearchProps> = ({ onSearch }) => {

  const handleSearch = (value: string) => {
    onSearch(value);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Also trigger search on clear
    if (e.target.value === '') {
      onSearch('');
    }
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <AntSearch
        placeholder="Search..."
        onSearch={handleSearch}
        enterButton
        size="large"
        allowClear
        onChange={handleChange}
      />
    </div>
  );
}; 