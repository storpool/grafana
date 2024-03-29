import { toDataFrame, FieldType } from '@grafana/data';

import {
  escapeLabelValueInExactSelector,
  getLabelTypeFromFrame,
  isBytesString,
  unescapeLabelValue,
} from './languageUtils';
import { LabelType } from './types';

describe('isBytesString', () => {
  it('correctly matches bytes string with integers', () => {
    expect(isBytesString('500b')).toBe(true);
    expect(isBytesString('2TB')).toBe(true);
  });
  it('correctly matches bytes string with float', () => {
    expect(isBytesString('500.4kib')).toBe(true);
    expect(isBytesString('10.4654Mib')).toBe(true);
  });
  it('does not match integer without unit', () => {
    expect(isBytesString('500')).toBe(false);
    expect(isBytesString('10')).toBe(false);
  });
  it('does not match float without unit', () => {
    expect(isBytesString('50.047')).toBe(false);
    expect(isBytesString('1.234')).toBe(false);
  });
});

describe('escapeLabelValueInExactSelector', () => {
  it.each`
    value                      | escapedValue
    ${'nothing to escape'}     | ${'nothing to escape'}
    ${'escape quote: "'}       | ${'escape quote: \\"'}
    ${'escape newline: \nend'} | ${'escape newline: \\nend'}
    ${'escape slash: \\'}      | ${'escape slash: \\\\'}
  `('when called with $value', ({ value, escapedValue }) => {
    expect(escapeLabelValueInExactSelector(value)).toEqual(escapedValue);
  });
});

describe('unescapeLabelValueInExactSelector', () => {
  it.each`
    value                       | unescapedValue
    ${'nothing to unescape'}    | ${'nothing to unescape'}
    ${'escape quote: \\"'}      | ${'escape quote: "'}
    ${'escape newline: \\nend'} | ${'escape newline: \nend'}
    ${'escape slash: \\\\'}     | ${'escape slash: \\'}
  `('when called with $value', ({ value, unescapedValue }) => {
    expect(unescapeLabelValue(value)).toEqual(unescapedValue);
  });
});

describe('getLabelTypeFromFrame', () => {
  const frameWithTypes = toDataFrame({
    fields: [
      { name: 'Time', type: FieldType.time, values: [0] },
      {
        name: 'Line',
        type: FieldType.string,
        values: ['line1'],
      },
      { name: 'labelTypes', type: FieldType.other, values: [{ indexed: 'I', parsed: 'P', structured: 'S' }] },
    ],
  });
  const frameWithoutTypes = toDataFrame({
    fields: [
      { name: 'Time', type: FieldType.time, values: [0] },
      {
        name: 'Line',
        type: FieldType.string,
        values: ['line1'],
      },
      { name: 'labels', type: FieldType.other, values: [{ job: 'test' }] },
    ],
  });
  it('returns structuredMetadata', () => {
    expect(getLabelTypeFromFrame('structured', frameWithTypes, 0)).toBe(LabelType.StructuredMetadata);
  });
  it('returns indexed', () => {
    expect(getLabelTypeFromFrame('indexed', frameWithTypes, 0)).toBe(LabelType.Indexed);
  });
  it('returns parsed', () => {
    expect(getLabelTypeFromFrame('parsed', frameWithTypes, 0)).toBe(LabelType.Parsed);
  });
  it('returns null for unknown field', () => {
    expect(getLabelTypeFromFrame('unknown', frameWithTypes, 0)).toBe(null);
  });
  it('returns null for frame without types', () => {
    expect(getLabelTypeFromFrame('job', frameWithoutTypes, 0)).toBe(null);
  });
});
