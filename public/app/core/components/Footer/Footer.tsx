import { css } from '@emotion/css';
import { memo } from 'react';

import { GrafanaTheme2, LinkTarget } from '@grafana/data';
import { config } from '@grafana/runtime';
import { IconName, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';

export interface FooterLink {
  target: LinkTarget;
  text: string;
  id: string;
  icon?: IconName;
  url?: string;
}

export let getFooterLinks = (): FooterLink[] => {
  return [
    {
      target: '_blank',
      id: 'documentation',
      text: t('nav.help/documentation', 'Documentation'),
      icon: 'document-info',
      url: 'https://grafana.com/docs/grafana/latest/?utm_source=grafana_footer',
    },
    {
      target: '_blank',
      id: 'support',
      text: t('nav.help/support', 'Support'),
      icon: 'question-circle',
      url: 'https://grafana.com/products/enterprise/?utm_source=grafana_footer',
    },
    {
      target: '_blank',
      id: 'community',
      text: t('nav.help/community', 'Community'),
      icon: 'comments-alt',
      url: 'https://community.grafana.com/?utm_source=grafana_footer',
    },
  ];
};

export function getVersionMeta(version: string) {
  const isBeta = version.includes('-beta');

  return {
    hasReleaseNotes: true,
    isBeta,
  };
}

export function getVersionLinks(hideEdition?: boolean): FooterLink[] {
  const { buildInfo, licenseInfo } = config;
  const stateInfo = licenseInfo.stateInfo ? ` (${licenseInfo.stateInfo})` : '';
  const links: FooterLink[] = [];

  if (!hideEdition) {
    links.push({
      target: '_blank',
      id: 'license',
      text: `${buildInfo.edition}${stateInfo}`,
      url: licenseInfo.licenseUrl,
    });
  }

  if (buildInfo.hideVersion) {
    return links;
  }

  const { hasReleaseNotes } = getVersionMeta(buildInfo.version);

  links.push({
    target: '_blank',
    id: 'version',
    text: buildInfo.versionString,
    url: hasReleaseNotes ? `https://github.com/grafana/grafana/blob/main/CHANGELOG.md` : undefined,
  });

  if (buildInfo.hasUpdate) {
    links.push({
      target: '_blank',
      id: 'updateVersion',
      text: `New version available!`,
      icon: 'download-alt',
      url: 'https://grafana.com/grafana/download?utm_source=grafana_footer',
    });
  }

  return links;
}

export function setFooterLinksFn(fn: typeof getFooterLinks) {
  getFooterLinks = fn;
}

export interface Props {
  /** Link overrides to show specific links in the UI */
  customLinks?: FooterLink[] | null;
  hideEdition?: boolean;
}

export const Footer = memo(({ customLinks, hideEdition }: Props) => {
  const styles = useStyles2(getStyles);
  const d = new Date();
  const year = d.getFullYear();

  return (
    <footer className={styles.footer}>
      <div className="text-center">
        <ul className={styles.list}>
               Copyright &copy; {year} <a href="http://storpool.com" target="_blank">StorPool Storage</a>.
        </ul>
      </div>
    </footer>
  );
});

Footer.displayName = 'Footer';

const getStyles = (theme: GrafanaTheme2) => ({
  footer: css({
    ...theme.typography.bodySmall,
    color: theme.colors.text.primary,
    display: 'block',
    padding: theme.spacing(2, 0),
    position: 'relative',
    width: '98%',

    'a:hover': {
      color: theme.colors.text.maxContrast,
      textDecoration: 'underline',
    },

    [theme.breakpoints.down('md')]: {
      display: 'none',
    },
  }),
  list: css({
    listStyle: 'none',
  }),
  listItem: css({
    display: 'inline-block',
    '&:after': {
      content: "' | '",
      padding: theme.spacing(0, 1),
    },
    '&:last-child:after': {
      content: "''",
      paddingLeft: 0,
    },
  }),
});
