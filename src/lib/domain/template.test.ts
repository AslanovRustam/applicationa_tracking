import { describe, expect, it } from 'vitest';
import { extractVariables, fillTemplate } from './template';
import { makeApp } from './test-helpers';

describe('extractVariables', () => {
  it('returns unique variables in order of appearance', () => {
    expect(extractVariables('Hi {имя}, {должность} at {компания}, {компания}')).toEqual(['имя', 'должность', 'компания']);
  });

  it('ignores braces that are not variables', () => {
    expect(extractVariables('{ не переменная } и {}')).toEqual([]);
  });
});

describe('fillTemplate', () => {
  const app = makeApp({ company: 'GR8_TECH', position: 'Senior Front End Developer', contact: '' });

  it('fills application fields', () => {
    expect(fillTemplate('{должность} at {компания}', app, {})).toEqual({
      text: 'Senior Front End Developer at GR8_TECH',
      missing: [],
    });
  });

  it('treats an empty application field as missing and leaves the placeholder', () => {
    expect(fillTemplate('Привет, {контакт}!', app, {})).toEqual({ text: 'Привет, {контакт}!', missing: ['контакт'] });
  });

  it('uses extra values for missing fields', () => {
    expect(fillTemplate('Привет, {контакт}!', app, { контакт: 'Анна' })).toEqual({ text: 'Привет, Анна!', missing: [] });
  });

  it('reports all application variables as missing when no application is chosen', () => {
    expect(fillTemplate('{компания} {должность} {ссылка} {контакт}', null, {}).missing).toEqual([
      'компания',
      'должность',
      'ссылка',
      'контакт',
    ]);
  });

  it('takes custom variables from extra or reports them missing', () => {
    expect(fillTemplate('Hi {имя}', app, {}).missing).toEqual(['имя']);
    expect(fillTemplate('Hi {имя}', app, { имя: 'Olga' }).text).toBe('Hi Olga');
  });

  it('ignores blank extra values', () => {
    expect(fillTemplate('Hi {имя}', app, { имя: '  ' }).missing).toEqual(['имя']);
  });
});
