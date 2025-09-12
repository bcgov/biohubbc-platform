interface PageTitleProps {
  title: string;
  description: string;
}

export const PageTitle = ({ title, description }: PageTitleProps) => {
  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
    </>
  );
};
