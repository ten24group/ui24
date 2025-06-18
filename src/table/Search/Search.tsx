import React, { useState, useEffect } from 'react';
import { Input } from 'antd';

const { Search: AntSearch } = Input;

interface ISearchProps {
  onSearch: (value: string) => void;
  value: string;
}

export const Search = ({ onSearch, value }: ISearchProps) => {
  const [ searchTerm, setSearchTerm ] = useState(value);

  useEffect(() => {
    setSearchTerm(value);
  }, [ value ]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const onSearchPress = () => {
    onSearch(searchTerm);
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <AntSearch
        placeholder="Search..."
        value={searchTerm}
        onChange={handleSearch}
        onSearch={onSearchPress}
        enterButton
        size="middle"
        allowClear
      />
    </div>
  );
}; 