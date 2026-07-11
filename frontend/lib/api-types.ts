export type ApiListResponse<TItem> = {
  success: boolean;
  vendors: TItem[];
};

export type ApiEntityResponse<TEntity> = {
  success: boolean;
  user: TEntity;
};
