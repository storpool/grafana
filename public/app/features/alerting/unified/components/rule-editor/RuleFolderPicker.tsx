import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, Tooltip, useStyles2, Stack } from '@grafana/ui';
import { OldFolderPicker, Props as FolderPickerProps } from 'app/core/components/Select/OldFolderPicker';
import { PermissionLevelString, SearchQueryType } from 'app/types';

import { FolderWarning, CustomAdd } from '../../../../../core/components/Select/OldFolderPicker';

export interface Folder {
  title: string;
  uid: string;
}

export interface RuleFolderPickerProps extends Omit<FolderPickerProps, 'initialTitle' | 'initialFolderId'> {
  value?: Folder;
}

const SlashesWarning = () => {
  const styles = useStyles2(getStyles);
  const onClick = () => window.open('https://github.com/grafana/grafana/issues/42947', '_blank');
  return (
    <Stack gap={0.5}>
      <div className={styles.slashNotAllowed}>Folders with &apos;/&apos; character are not allowed.</div>
      <Tooltip placement="top" content={'Link to the Github issue'} theme="info">
        <Icon name="info-circle" size="xs" className={styles.infoIcon} onClick={onClick} />
      </Tooltip>
    </Stack>
  );
};

export const containsSlashes = (str: string): boolean => str.indexOf('/') !== -1;

export function RuleFolderPicker(props: RuleFolderPickerProps) {
  const { value } = props;
  const warningCondition = (folderName: string) => containsSlashes(folderName);

  const folderWarning: FolderWarning = {
    warningCondition: warningCondition,
    warningComponent: SlashesWarning,
  };

  const customAdd: CustomAdd = {
    disallowValues: true,
    isAllowedValue: (value) => !containsSlashes(value),
  };

  return (
    <OldFolderPicker
      showRoot={false}
      rootName=""
      allowEmpty={true}
      initialTitle={value?.title}
      initialFolderUid={value?.uid}
      searchQueryType={SearchQueryType.AlertFolder}
      {...props}
      permissionLevel={PermissionLevelString.Edit}
      customAdd={customAdd}
      folderWarning={folderWarning}
    />
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  slashNotAllowed: css`
    color: ${theme.colors.warning.main};
    font-size: 12px;
    margin-bottom: 2px;
  `,
  infoIcon: css`
    color: ${theme.colors.warning.main};
    font-size: 12px;
    margin-bottom: 2px;
    cursor: pointer;
  `,
});
