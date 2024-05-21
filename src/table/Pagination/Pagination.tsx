import React from "react";
import styles from "./Pagination.module.css";
import cx from "classnames";


interface IPagination {
    isLastPage?: boolean
    currentPage: number
    onPageChange: (pageNumber: number) => void
}
export const CustomPagination = ({
    isLastPage = false,
    currentPage = 1,
    onPageChange
} : IPagination ) => {

  return (
    <>
      <ul className={styles.pagination}>
        <li
          className={ cx( styles.paginationItem, currentPage === 1 ? styles.paginationItemDisabled : "", styles.paginationClick) }
          onClick={ (e) => {
            e.preventDefault()
            currentPage > 1  ? onPageChange(currentPage - 1): null
          } }
        >
          <PrevArrawIcon />
        </li>
        <li className={ cx(styles.paginationItem, styles.paginationActive) }>
          { currentPage }
        </li>
        <li className={ cx(styles.paginationItem, isLastPage ? styles.paginationItemDisabled : "", styles.paginationClick)}
        onClick={ (e) => {
          e.preventDefault()
          !isLastPage ? onPageChange(currentPage + 1) : null
         } }
        >
          <NextArrowIcon />
        </li>
      </ul>
    </>
  );
};


const PrevArrawIcon = () => {
    return <span role="img" aria-label="left">
    <svg
      viewBox="64 64 896 896"
      focusable="false"
      data-icon="left"
      width="1em"
      height="1em"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M724 218.3V141c0-6.7-7.7-10.4-12.9-6.3L260.3 486.8a31.86 31.86 0 000 50.3l450.8 352.1c5.3 4.1 12.9.4 12.9-6.3v-77.3c0-4.9-2.3-9.6-6.1-12.6l-360-281 360-281.1c3.8-3 6.1-7.7 6.1-12.6z"></path>
    </svg>
  </span>
}

const NextArrowIcon = () => {
    return <span role="img" aria-label="right">
    <svg
      viewBox="64 64 896 896"
      focusable="false"
      data-icon="right"
      width="1em"
      height="1em"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M765.7 486.8L314.9 134.7A7.97 7.97 0 00302 141v77.3c0 4.9 2.3 9.6 6.1 12.6l360 281.1-360 281.1c-3.9 3-6.1 7.7-6.1 12.6V883c0 6.7 7.7 10.4 12.9 6.3l450.8-352.1a31.96 31.96 0 000-50.4z"></path>
    </svg>
  </span>
}