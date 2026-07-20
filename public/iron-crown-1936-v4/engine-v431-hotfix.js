'use strict';

/** V4.3.1 event-depth and player-state safety fixes. */
(() => {
  const proto = IronCrownV4.prototype;
  const previousChoices = proto.strategicEventChoices;
  proto.strategicEventChoices = function strategicEventChoicesV431Hotfix(eventId) {
    const player = this.player;

    if (eventId === 'anti-comintern') {
      if (player === 'GER') return [
        { id: 'propose-anti-comintern', title: '推动反共产国际协定', description: '邀请意大利及其他反共产主义国家建立外交和情报协作。', effect: '政治点 -20；德意关系 +15；德苏关系 -20；世界紧张度 +2', default: true },
        { id: 'secret-intelligence-cooperation', title: '仅建立秘密情报合作', description: '避免公开阵营化，只与意大利交换共产国际情报。', effect: '政治点 -10；情报能力提高；世界紧张度 +1' },
        { id: 'postpone-pact', title: '推迟协定', description: '优先维持对苏贸易和外交回旋空间。', effect: '政治点 +10；德苏关系 +5' },
      ];
      if (player === 'ITA') return [
        { id: 'join-anti-comintern', title: '加入反共产国际协定', description: '公开接近德国，建立反共产主义外交合作。', effect: '意德关系 +20；意苏关系 -15；世界紧张度 +2', default: true },
        { id: 'keep-distance-germany', title: '与德国保持距离', description: '维持独立外交，避免过早加入德国主导的阵营。', effect: '政治点 +10；英法关系小幅改善' },
      ];
      if (player === 'USSR') return [
        { id: 'counter-anti-comintern', title: '组织反制外交', description: '加强与法国、捷克斯洛伐克及左翼力量的安全联系。', effect: '政治点 -20；对法、对捷关系 +12；德国关系 -10', default: true },
        { id: 'expand-intelligence-network', title: '扩建欧洲情报网', description: '提高对德国和意大利政治军事动向的预警。', effect: '政治点 -15；情报能力提高' },
        { id: 'ignore-propaganda-pact', title: '淡化协定影响', description: '将其视为宣传性文件，避免过度反应。', effect: '稳定度 +1；政治点 +5' },
      ];
    }

    if (eventId === 'sino-japanese-war') {
      if (player === 'USSR') return [
        { id: 'soviet-aid-china', title: '向中国提供航空与装备援助', description: '以贷款、飞机和顾问牵制日本，同时避免直接参战。', effect: '政治点 -20；消耗50架战斗机和3000件装备；远东安全改善；紧张度 +1', default: true },
        { id: 'reinforce-far-east', title: '加强远东军区', description: '减少对外援助，把资源用于边境部队和铁路补给。', effect: '指挥点 +10；战争支持 +3；政治点 -10' },
        { id: 'maintain-neutrality-east-asia', title: '维持东亚中立', description: '避免资源被远东局势牵制。', effect: '政治点 +10' },
      ];
      if (player === 'UK' || player === 'FRA') return [
        { id: 'limited-aid-china', title: '提供有限贷款与物资', description: '支持中国抵抗能力，同时避免立即对日制裁。', effect: '政治点 -10；稳定度 +1；世界紧张度 +1', default: true },
        { id: 'restrict-japanese-trade', title: '限制对日战略物资贸易', description: '逐步限制军需和金融渠道，承担亚洲殖民地风险。', effect: '政治点 -20；世界紧张度 +2；建立贸易限制' },
        { id: 'protect-asian-possessions', title: '优先加强亚洲殖民地防务', description: '扩建基地和驻军，不直接介入中国战场。', effect: '指挥点 +8；战争支持 +2' },
      ];
      if (player === 'GER' || player === 'ITA') return [
        { id: 'continue-china-mission', title: '维持对华军事合作', description: '继续现有顾问和工业合作，避免完全转向日本。', effect: '政治点 -10；对华贸易收益提高；与日本关系承压' },
        { id: 'pivot-to-japan', title: '战略转向日本', description: '逐步减少对华合作，争取日本加入反苏阵营。', effect: '政治点 -15；对苏关系 -8；世界紧张度 +1', default: true },
        { id: 'avoid-east-asian-commitment', title: '避免东亚承诺', description: '不在亚洲投入有限的外交和军工资源。', effect: '政治点 +8' },
      ];
    }

    if (eventId === 'czech-collapse') {
      if (player === 'GER') return [
        { id: 'occupy-bohemia-moravia', title: '占领波希米亚与摩拉维亚', description: '终结捷克国家主体并控制其工业与军工体系。', effect: '世界紧张度 +8；获得工业加成；英法关系严重恶化', default: true },
        { id: 'create-dependent-czech-state', title: '建立受控附属政权', description: '保留有限地方行政，降低直接占领成本。', effect: '世界紧张度 +5；获得附庸关系；行政负担较低' },
        { id: 'respect-munich-settlement', title: '暂时遵守慕尼黑安排', description: '不进一步吞并捷克地区，以维持国际缓和。', effect: '政治点 +15；世界紧张度 -2；稳定度 -2' },
      ];
      if (player === 'CZE') return [
        { id: 'czech-final-resistance', title: '组织最后抵抗', description: '动员残余军队和边境工事，拒绝国家被肢解。', effect: '战争支持 +12；稳定度 -5；可用人力 +60K；德国关系 -40', default: true },
        { id: 'accept-protectorate', title: '接受保护国安排', description: '避免城市和工业遭受战争破坏，但主权大幅丧失。', effect: '战争支持 -8；稳定度 +2；进入附属状态' },
        { id: 'seek-exile-government', title: '筹建流亡政府', description: '转移政治和军事人员，为长期抵抗保存合法性。', effect: '政治点 +20；对英法关系 +15' },
      ];
      if (player === 'HUN' || player === 'POL') return [
        { id: 'press-territorial-claims', title: '提出领土要求', description: '利用捷克斯洛伐克危机谋求边境领土调整。', effect: '政治点 -15；战争支持 +3；紧张度 +2', default: true },
        { id: 'support-czech-sovereignty', title: '支持捷克国家主权', description: '放弃短期领土收益，警惕德国在中欧扩张。', effect: '对捷关系 +18；对德关系 -10' },
      ];
      if (player === 'UK' || player === 'FRA') return [
        { id: 'condemn-czech-occupation', title: '谴责占领并重新武装', description: '承认绥靖政策失败，加快军备和安全保障。', effect: '政治点 -20；战争支持 +6；对德关系 -25', default: true },
        { id: 'economic-sanctions-germany', title: '对德国扩大经济制裁', description: '限制金融和战略物资贸易，但承担经济代价。', effect: '政治点 -15；建立禁运；世界紧张度 +2' },
        { id: 'avoid-new-guarantees', title: '避免新的安全保障', description: '继续优先国内稳定和防御准备。', effect: '稳定度 +2；战争支持 -2' },
      ];
    }

    return previousChoices.call(this, eventId);
  };

  const previousApply = proto.applyStrategicChoice;
  proto.applyStrategicChoice = function applyStrategicChoiceV431Hotfix(eventId, choiceId) {
    const country = this.currentCountry();
    const adjustRelation = (target, delta) => {
      if (this.countries[target]) this.setRelation(this.player, target, this.relation(this.player, target) + delta);
    };
    const adjust = ({ pp = 0, stability = 0, warSupport = 0, tension = 0, command = 0, manpower = 0 } = {}) => {
      country.pp = Math.max(0, country.pp + pp);
      country.stability = clamp(country.stability + stability, 0, 100);
      country.warSupport = clamp(country.warSupport + warSupport, 0, 100);
      country.commandPower = clamp(country.commandPower + command, 0, 100);
      country.availableManpower = Math.max(0, country.availableManpower + manpower);
      this.worldTension = clamp(this.worldTension + tension, 0, 100);
    };

    // Do not make the player's country unplayable when Austria accepts political union.
    if (eventId === 'anschluss-crisis' && choiceId === 'accept-union' && this.player === 'AUT') {
      adjust({ stability: 2, warSupport: -8 });
      country.politicalStatus = '德奥合并过渡政府';
      country.autonomy = 15;
      this.puppets.AUT = { master: 'GER', autonomy: 15, politicalUnion: true };
      this.setRelation('AUT', 'GER', 90);
      this.worldTension = clamp(this.worldTension + 4, 0, 100);
      return { ok: true, outcome: '奥地利接受合并安排，进入受德国控制的政治过渡状态；玩家仍可继续管理过渡时期的行政、军队和经济。' };
    }

    if (eventId === 'anti-comintern') {
      if (choiceId === 'propose-anti-comintern') { adjust({ pp: -20, tension: 2 }); adjustRelation('ITA', 15); adjustRelation('USSR', -20); this.treaties[this.pair('GER', 'ITA')] = { type: '反共产国际协作', date: this.date }; return { ok: true, outcome: '德国与意大利建立公开反共产主义外交协作，欧洲阵营化进一步加深。' }; }
      if (choiceId === 'secret-intelligence-cooperation') { adjust({ pp: -10, tension: 1 }); country.strategicModifiers.intelligence = (country.strategicModifiers.intelligence || 0) + 0.08; adjustRelation('ITA', 8); return { ok: true, outcome: '德意建立秘密情报交流机制，但没有立即签署公开协定。' }; }
      if (choiceId === 'postpone-pact') { adjust({ pp: 10 }); adjustRelation('USSR', 5); return { ok: true, outcome: '德国推迟反共产国际协定，以保留对苏贸易和外交空间。' }; }
      if (choiceId === 'join-anti-comintern') { adjust({ tension: 2 }); adjustRelation('GER', 20); adjustRelation('USSR', -15); this.treaties[this.pair('GER', 'ITA')] = { type: '反共产国际协作', date: this.date }; return { ok: true, outcome: '意大利加入德国推动的反共产国际外交体系。' }; }
      if (choiceId === 'keep-distance-germany') { adjust({ pp: 10 }); adjustRelation('GER', -5); adjustRelation('UK', 5); adjustRelation('FRA', 5); return { ok: true, outcome: '意大利拒绝过早加入德国主导的阵营，继续保持独立外交。' }; }
      if (choiceId === 'counter-anti-comintern') { adjust({ pp: -20 }); adjustRelation('FRA', 12); adjustRelation('CZE', 12); adjustRelation('GER', -10); return { ok: true, outcome: '苏联加强与法国和捷克斯洛伐克的安全联系，以反制反共产国际合作。' }; }
      if (choiceId === 'expand-intelligence-network') { adjust({ pp: -15 }); country.strategicModifiers.intelligence = (country.strategicModifiers.intelligence || 0) + 0.1; return { ok: true, outcome: '苏联在欧洲扩建情报网络，对德国和意大利的战略预警能力提高。' }; }
      if (choiceId === 'ignore-propaganda-pact') { adjust({ pp: 5, stability: 1 }); return { ok: true, outcome: '苏联淡化协定的宣传影响，没有进行大规模外交反制。' }; }
    }

    if (eventId === 'sino-japanese-war') {
      if (choiceId === 'soviet-aid-china') {
        if ((country.stockpile.fighter || 0) < 50 || (country.stockpile.infantry_equipment || 0) < 3000) return { ok: false, reason: '需要50架战斗机和3000件步兵装备' };
        country.stockpile.fighter -= 50; country.stockpile.infantry_equipment -= 3000; adjust({ pp: -20, tension: 1 }); country.strategicModifiers.intelligence += 0.03; return { ok: true, outcome: '苏联航空兵、装备和顾问开始支援中国，牵制日本在亚洲的军事力量。' };
      }
      if (choiceId === 'reinforce-far-east') { adjust({ pp: -10, command: 10, warSupport: 3 }); return { ok: true, outcome: '苏联加强远东军区和西伯利亚铁路军事运输准备。' }; }
      if (choiceId === 'maintain-neutrality-east-asia') { adjust({ pp: 10 }); return { ok: true, outcome: '苏联避免扩大亚洲投入，优先保留欧洲方向资源。' }; }
      if (choiceId === 'limited-aid-china') { adjust({ pp: -10, stability: 1, tension: 1 }); return { ok: true, outcome: '有限贷款和非军事物资开始流向中国。' }; }
      if (choiceId === 'restrict-japanese-trade') { adjust({ pp: -20, tension: 2 }); country.strategicModifiers.intelligence += 0.02; return { ok: true, outcome: '政府开始限制对日战略贸易，亚洲经济摩擦升级。' }; }
      if (choiceId === 'protect-asian-possessions') { adjust({ command: 8, warSupport: 2 }); return { ok: true, outcome: '海空军资源被调往亚洲基地，殖民地防务得到加强。' }; }
      if (choiceId === 'continue-china-mission') { adjust({ pp: -10 }); country.modifiers.mil_output += 0.01; return { ok: true, outcome: '对华顾问和工业合作继续维持，但与日本的战略接近受到限制。' }; }
      if (choiceId === 'pivot-to-japan') { adjust({ pp: -15, tension: 1 }); adjustRelation('USSR', -8); return { ok: true, outcome: '政府逐步转向日本，试图构建更广泛的反苏合作。' }; }
      if (choiceId === 'avoid-east-asian-commitment') { adjust({ pp: 8 }); return { ok: true, outcome: '国家避免对东亚战争作出实质承诺。' }; }
    }

    if (eventId === 'czech-collapse') {
      if (choiceId === 'occupy-bohemia-moravia') { adjust({ tension: 8 }); country.modifiers.mil_output += 0.05; adjustRelation('UK', -20); adjustRelation('FRA', -22); if (this.countries.CZE) this.countries.CZE.alive = false; return { ok: true, outcome: '德国占领波希米亚与摩拉维亚并接管重要军工体系，英法确认绥靖政策已经失败。' }; }
      if (choiceId === 'create-dependent-czech-state') { adjust({ tension: 5 }); this.puppets.CZE = { master: 'GER', autonomy: 35 }; adjustRelation('CZE', -10); return { ok: true, outcome: '德国建立受控的捷克附属政权，以较低行政成本控制其工业。' }; }
      if (choiceId === 'respect-munich-settlement') { adjust({ pp: 15, stability: -2, tension: -2 }); return { ok: true, outcome: '德国暂时停止进一步扩张，中欧危机短暂缓和。' }; }
      if (choiceId === 'czech-final-resistance') { adjust({ stability: -5, warSupport: 12, manpower: 60 }); adjustRelation('GER', -40); return { ok: true, outcome: '捷克斯洛伐克拒绝解体并进入紧急动员，边境防线重新进入战备状态。' }; }
      if (choiceId === 'accept-protectorate') { adjust({ stability: 2, warSupport: -8 }); this.puppets.CZE = { master: 'GER', autonomy: 25 }; return { ok: true, outcome: '捷克政府接受保护国安排，保留有限行政但失去大部分外交和军事主权。' }; }
      if (choiceId === 'seek-exile-government') { adjust({ pp: 20 }); adjustRelation('UK', 15); adjustRelation('FRA', 15); country.politicalStatus = '流亡政府筹备中'; return { ok: true, outcome: '政府转移关键人员和政治合法性，准备在国外继续抵抗。' }; }
      if (choiceId === 'press-territorial-claims') { adjust({ pp: -15, warSupport: 3, tension: 2 }); adjustRelation('CZE', -20); return { ok: true, outcome: '政府利用捷克危机提出领土要求，中欧边界争议进一步扩大。' }; }
      if (choiceId === 'support-czech-sovereignty') { adjustRelation('CZE', 18); adjustRelation('GER', -10); return { ok: true, outcome: '国家放弃短期领土收益，转而支持捷克斯洛伐克主权。' }; }
      if (choiceId === 'condemn-czech-occupation') { adjust({ pp: -20, warSupport: 6 }); adjustRelation('GER', -25); country.modifiers.mil_output += 0.02; return { ok: true, outcome: '政府公开谴责德国行动，并启动更快的军备准备。' }; }
      if (choiceId === 'economic-sanctions-germany') { adjust({ pp: -15, tension: 2 }); this.embargoes[this.pair(this.player, 'GER')] = { imposedBy: this.player, target: 'GER', start: this.date, event: eventId }; adjustRelation('GER', -20); return { ok: true, outcome: '针对德国的金融和战略物资限制扩大。' }; }
      if (choiceId === 'avoid-new-guarantees') { adjust({ stability: 2, warSupport: -2 }); return { ok: true, outcome: '政府避免作出新的安全保障，国内稳定优先于大陆承诺。' }; }
    }

    return previousApply.call(this, eventId, choiceId);
  };
})();
